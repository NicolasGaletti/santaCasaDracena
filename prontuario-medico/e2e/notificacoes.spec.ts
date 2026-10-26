import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

const SENHA = 'Teste@123';
const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONTAINER_DB = 'supabase_db_prontuario-medico';

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
}

function sqlLocal(sql: string): string {
  return execFileSync('docker', ['exec', CONTAINER_DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql], {
    encoding: 'utf8',
  }).trim();
}

/** Cada projeto (mobile/desktop) usa um usuário próprio nos testes que mexem em leitura/preferências. */
function emailDoProjeto(projeto: string): string {
  return projeto === 'mobile' ? 'residente@teste.local' : 'enfermeira@teste.local';
}

function idDe(email: string): string {
  return sqlLocal(`select id from auth.users where email = '${email}'`);
}

async function contador(page: Page): Promise<number> {
  const badge = page.getByTestId('contador-notificacoes');
  if ((await badge.count()) === 0) return 0;
  return Number(await badge.innerText());
}

test('acadêmico envia e o médico vê o contador subir', async ({ page, browser }) => {
  const leito = `NOT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('link', { name: 'Admitir paciente' }).click();
  await page.getByLabel('Nome completo').fill(`Paciente notificação ${leito}`);
  await page.getByLabel('Data de nascimento').fill('1968-05-02');
  await page.getByLabel('Convênio').selectOption({ label: 'SUS' });
  await page.getByRole('radio', { name: 'Cardiologia' }).click();
  await page.getByLabel('Leito / ala').fill(leito);
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 });
  const id = new URL(page.url()).pathname.split('/').pop() as string;

  await page.goto('/');
  await expect(page.getByRole('link', { name: /^Notificações/ })).toBeVisible();
  const antes = await contador(page);

  // Outra sessão (acadêmico) envia a evolução; o médico não recarrega a página.
  const ctx = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const outra = await ctx.newPage();
  await entrar(outra, 'academico@teste.local');
  await outra.goto(`/internacoes/${id}`);
  await outra.getByLabel('Evolução clínica').fill('Evolução para notificar');
  await outra.getByRole('textbox', { name: 'Conduta' }).fill('Conduta para notificar');
  await outra.getByRole('button', { name: 'Enviar para validação', exact: true }).click();
  await outra.getByRole('button', { name: 'Confirmar envio' }).click();
  // A ficha recomeça vazia quando a conclusão termina: o diálogo some junto.
  await expect(outra.getByRole('dialog')).toBeHidden();
  await ctx.close();

  await expect.poll(() => contador(page), { timeout: 15_000 }).toBeGreaterThan(antes);
});

test('marcar como lida zera o contador', async ({ page }, testInfo) => {
  const email = emailDoProjeto(testInfo.project.name);
  const uid = idDe(email);
  sqlLocal(`update public.notificacoes set lida_em = now() where destinatario_id = '${uid}' and lida_em is null`);
  const texto = `Aviso de teste ${Math.random().toString(36).slice(2, 8)}`;
  sqlLocal(
    `insert into public.notificacoes (destinatario_id, tipo, texto) values ('${uid}', 'evolucao_validada', '${texto}')`,
  );

  await entrar(page, email);
  await expect(page.getByTestId('contador-notificacoes')).toHaveText('1');

  await page.getByRole('link', { name: /^Notificações/ }).click();
  await expect(page).toHaveURL(/\/notificacoes$/);
  await expect(page.getByRole('heading', { name: 'Notificações' })).toBeVisible();
  await page.getByRole('link', { name: new RegExp(texto) }).click();
  await expect(page.getByTestId('contador-notificacoes')).toHaveCount(0);

  // "Marcar todas como lidas" também zera.
  sqlLocal(
    `insert into public.notificacoes (destinatario_id, tipo, texto) values ('${uid}', 'evolucao_validada', '${texto} 2')`,
  );
  await page.goto('/notificacoes');
  await expect(page.getByTestId('contador-notificacoes')).toHaveText('1');
  await page.getByRole('button', { name: 'Marcar todas como lidas' }).click();
  await expect(page.getByTestId('contador-notificacoes')).toHaveCount(0);
  expect(sqlLocal(`select count(*) from public.notificacoes where destinatario_id = '${uid}' and lida_em is null`)).toBe('0');
});

test('admin não tem sino', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'somente desktop');
  const { entrarAdmin } = await import('./helpers/mfa');
  await entrarAdmin(page);
  await expect(page.getByRole('link', { name: /^Notificações/ })).toHaveCount(0);
});

test('preferências salvam', async ({ page }, testInfo) => {
  const email = emailDoProjeto(testInfo.project.name);
  const uid = idDe(email);
  sqlLocal(`delete from public.preferencias_notificacao where profissional_id = '${uid}'`);
  await entrar(page, email);
  await page.goto('/conta/notificacoes');
  await expect(page.getByText('No iPhone, as notificações só funcionam com o app instalado na tela inicial.')).toBeVisible();

  const validacao = page.getByLabel('Evolução aguardando minha validação');
  const devolvida = page.getByLabel('Evolução devolvida para mim');
  await expect(validacao).toBeChecked();
  await expect(devolvida).toBeChecked();

  await devolvida.uncheck();
  await page.getByRole('button', { name: 'Salvar preferências' }).click();
  await expect(page.getByText('Preferências salvas.')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Evolução aguardando minha validação')).toBeChecked();
  await expect(page.getByLabel('Evolução devolvida para mim')).not.toBeChecked();
  expect(
    sqlLocal(`select push_validacao || ',' || push_devolvida from public.preferencias_notificacao where profissional_id = '${uid}'`),
  ).toBe('true,false');
});
