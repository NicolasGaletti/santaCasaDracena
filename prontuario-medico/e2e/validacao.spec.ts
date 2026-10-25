import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SENHA = 'Teste@123';
const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_CHAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const CONTAINER_DB = 'supabase_db_prontuario-medico';
const FOTO = path.join(__dirname, 'fixtures', 'exame.jpg');

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
}

function leitoUnico(): string {
  return `VAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Admite um paciente novo como medico1 (Cardiologia) e devolve o id da internação. */
async function admitirPaciente(page: Page, leito: string): Promise<string> {
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('link', { name: 'Admitir paciente' }).click();
  await page.getByLabel('Nome completo').fill(`Paciente validação ${leito}`);
  await page.getByLabel('Data de nascimento').fill('1968-05-02');
  await page.getByLabel('Convênio').fill('SUS');
  await page.getByLabel('Equipe responsável').selectOption({ label: 'Cardiologia' });
  await page.getByLabel('Leito / ala').fill(leito);
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 });
  return new URL(page.url()).pathname.split('/').pop() as string;
}

/** Consulta direta ao banco local (sem RLS), para achar o id da evolução enviada. */
function sqlLocal(sql: string): string {
  return execFileSync('docker', ['exec', CONTAINER_DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql], {
    encoding: 'utf8',
  }).trim();
}

/** Cliente como o médico (sessão própria): usado para devolver pela RPC, até a tela de validação existir. */
async function clienteComo(email: string): Promise<SupabaseClient> {
  const cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } });
  const { error } = await cliente.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw error;
  return cliente;
}

/** Acadêmico preenche a evolução médica (sem CRM) e envia para validação. */
async function academicoEnvia(page: Page, id: string, evolucao: string, conduta: string) {
  await entrar(page, 'academico@teste.local');
  await page.goto(`/internacoes/${id}`);
  await page.getByRole('link', { name: 'Nova evolução' }).click();
  await expect(page).toHaveURL(/\/evolucao$/);
  await page.getByLabel('Evolução clínica').fill(evolucao);
  await page.getByRole('textbox', { name: 'Conduta' }).fill(conduta);
  await page.getByRole('button', { name: 'Enviar para validação', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Depois de enviada, a evolução só pode ser alterada se o médico devolver.');
  await page.getByRole('button', { name: 'Confirmar envio' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO);
}

test('acadêmico envia e vê Aguardando validação', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.context().clearCookies();
  await academicoEnvia(page, id, 'Paciente em acompanhamento, sem intercorrências', 'Manter dieta e acompanhar');

  await expect(page.getByText('Aguardando validação', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalizar', exact: true })).toHaveCount(0);
});

test('após enviar não há formulário editável', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.context().clearCookies();
  await academicoEnvia(page, id, 'Evolução enviada para revisão', 'Conduta enviada');

  await page.goto(`/internacoes/${id}/evolucao`);
  await expect(page).toHaveURL(URL_PRONTUARIO);
  await expect(page.getByLabel('Evolução clínica')).toHaveCount(0);

  await page.goto(`/internacoes/${id}`);
  await expect(page.getByRole('link', { name: 'Nova evolução' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nova evolução' })).toBeDisabled();
  await expect(page.getByText('Você tem uma evolução aguardando validação.')).toBeVisible();
});

test('devolvida mostra motivo no rascunho', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.context().clearCookies();
  await academicoEnvia(page, id, 'Evolução para devolver', 'Conduta para devolver');

  const evolucaoId = sqlLocal(
    `select id from public.evolucoes where internacao_id = '${id}' and status = 'AGUARDANDO_VALIDACAO'`,
  );
  const medico = await clienteComo('medico1@teste.local');
  const { error } = await medico.rpc('devolver_evolucao', {
    p_evolucao_id: evolucaoId,
    p_motivo: 'Falta a dose do diurético na conduta',
  });
  expect(error).toBeNull();

  await entrar(page, 'academico@teste.local');
  await page.goto(`/internacoes/${id}`);
  await page.getByRole('link', { name: 'Continuar rascunho' }).click();
  await expect(page).toHaveURL(/\/evolucao$/);
  await expect(page.getByText('Devolvida pelo médico: Falta a dose do diurético na conduta')).toBeVisible();
  await expect(page.getByLabel('Evolução clínica')).toHaveValue('Evolução para devolver');

  // Corrige, reenvia: o motivo some do rascunho e a evolução volta a aguardar validação.
  await page.getByLabel('Evolução clínica').fill('Evolução corrigida com a dose do diurético');
  await page.getByRole('button', { name: 'Enviar para validação', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar envio' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO);
  await expect(page.getByText('Aguardando validação', { exact: true })).toBeVisible();
  expect(
    sqlLocal(`select devolvida_motivo is null from public.evolucoes where internacao_id = '${id}' and status = 'AGUARDANDO_VALIDACAO'`),
  ).toBe('t');
});

test('anexo não enviado bloqueia o envio com a mensagem de envio', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.context().clearCookies();
  await entrar(page, 'academico@teste.local');
  await page.goto(`/internacoes/${id}`);
  await page.getByRole('link', { name: 'Nova evolução' }).click();
  await page.getByRole('button', { name: 'Exames', exact: true }).click();

  await page.route('**/storage/v1/object/**', (r) => r.abort());
  await page.getByTestId('entrada-foto').setInputFiles(FOTO);
  await expect(page.getByText('Sem conexão. Tente enviar o anexo novamente.')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Exames', exact: true }).click();
  await page.getByLabel('Evolução clínica').fill('Evolução com anexo pendente');
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta de teste');
  await page.getByRole('button', { name: 'Enviar para validação', exact: true }).click();

  await expect(page.getByText('Há anexo não enviado. Envie de novo ou cancele antes de enviar.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/evolucao$/);
});

test.describe.serial('tela de validação do médico', () => {
  /** Contador da aba "Validar": ausente quando não há pendentes. */
  async function contadorValidacao(page: Page): Promise<number> {
    const badge = page.getByTestId('contador-validacao');
    if ((await badge.count()) === 0) return 0;
    return Number(await badge.innerText());
  }

  test('médico da equipe vê pendente e valida', async ({ page }) => {
    const leito = leitoUnico();
    const id = await admitirPaciente(page, leito);
    await page.context().clearCookies();
    await academicoEnvia(page, id, 'Evolução para validar', 'Conduta para validar');
    const evolucaoId = sqlLocal(
      `select id from public.evolucoes where internacao_id = '${id}' and status = 'AGUARDANDO_VALIDACAO'`,
    );

    await page.context().clearCookies();
    await entrar(page, 'medico1@teste.local');
    await page.getByRole('link', { name: /^Validar/ }).click();
    await expect(page).toHaveURL(/\/validacao$/);
    await page.getByRole('link', { name: new RegExp(`Paciente validação ${leito}`) }).click();

    await expect(page).toHaveURL(/\/validacao\?evolucao=/);
    await expect(page.getByRole('heading', { name: `Paciente validação ${leito}` })).toBeVisible();
    await expect(page.getByText('Evolução para validar')).toBeVisible();
    await expect(page.getByText(/Registrado por Acadêmico Teste \(teste\) – Acadêmico\(a\) de Medicina/)).toBeVisible();

    await page.getByRole('button', { name: 'Validar', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Ao validar, a evolução é finalizada e não pode mais ser alterada.');
    await page.getByRole('button', { name: 'Confirmar validação' }).click();

    await expect(page).toHaveURL(/\/validacao$/);
    await expect(page.getByRole('link', { name: new RegExp(`Paciente validação ${leito}`) })).toHaveCount(0);
    expect(sqlLocal(`select status from public.evolucoes where id = '${evolucaoId}'`)).toBe('FINALIZADA');
  });

  test('médico de outra equipe não vê pendente', async ({ page }) => {
    const leito = leitoUnico();
    const id = await admitirPaciente(page, leito);
    await page.context().clearCookies();
    await academicoEnvia(page, id, 'Evolução de outra equipe', 'Conduta de outra equipe');
    const evolucaoId = sqlLocal(
      `select id from public.evolucoes where internacao_id = '${id}' and status = 'AGUARDANDO_VALIDACAO'`,
    );

    await page.context().clearCookies();
    await entrar(page, 'medico2@teste.local');
    await page.goto('/validacao');
    await expect(page.getByRole('heading', { name: 'Validação' })).toBeVisible();
    await expect(page.getByText(`Paciente validação ${leito}`)).toHaveCount(0);
    await expect(page.getByText('Nenhuma evolução aguardando validação.')).toBeVisible();

    await page.goto(`/validacao?evolucao=${evolucaoId}`);
    await expect(page.getByRole('button', { name: 'Validar', exact: true })).toHaveCount(0);
  });

  test('devolver exige motivo e volta ao autor', async ({ page }) => {
    const leito = leitoUnico();
    const id = await admitirPaciente(page, leito);
    await page.context().clearCookies();
    await academicoEnvia(page, id, 'Evolução a devolver', 'Conduta a devolver');
    const evolucaoId = sqlLocal(
      `select id from public.evolucoes where internacao_id = '${id}' and status = 'AGUARDANDO_VALIDACAO'`,
    );

    await page.context().clearCookies();
    await entrar(page, 'medico1@teste.local');
    await page.goto(`/validacao?evolucao=${evolucaoId}`);
    await page.getByRole('button', { name: 'Devolver', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar devolução' }).click();
    await expect(page.getByRole('dialog')).toContainText('Informe o motivo da devolução.');
    await expect(page.getByRole('dialog').getByText('0/500')).toBeVisible();

    await page.getByLabel('Motivo da devolução').fill('Falta a dose do diurético na conduta');
    await expect(page.getByRole('dialog').getByText('36/500')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar devolução' }).click();
    await expect(page).toHaveURL(/\/validacao$/);
    expect(
      sqlLocal(`select status || '|' || devolvida_motivo from public.evolucoes where id = '${evolucaoId}'`),
    ).toBe('RASCUNHO|Falta a dose do diurético na conduta');

    await page.context().clearCookies();
    await entrar(page, 'academico@teste.local');
    await page.goto(`/internacoes/${id}`);
    await page.getByRole('link', { name: 'Continuar rascunho' }).click();
    await expect(page.getByText('Devolvida pelo médico: Falta a dose do diurético na conduta')).toBeVisible();
  });

  test('contador some após validar', async ({ page }) => {
    const leito = leitoUnico();
    const id = await admitirPaciente(page, leito);
    await page.context().clearCookies();
    await academicoEnvia(page, id, 'Evolução do contador', 'Conduta do contador');

    await page.context().clearCookies();
    await entrar(page, 'medico1@teste.local');
    await page.goto('/validacao');
    const antes = await contadorValidacao(page);
    expect(antes).toBeGreaterThanOrEqual(1);

    await page.getByRole('link', { name: new RegExp(`Paciente validação ${leito}`) }).click();
    await page.getByRole('button', { name: 'Validar', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar validação' }).click();
    await expect(page).toHaveURL(/\/validacao$/);

    expect(await contadorValidacao(page)).toBe(antes - 1);
  });
});
