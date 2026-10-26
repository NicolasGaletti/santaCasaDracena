import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SENHA = 'Teste@123';
const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const URL_EVOLUCAO = /\/internacoes\/[0-9a-f-]{36}\/evolucao$/;
const TITULO_ADENDO = /^Adendo à evolução de \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_CHAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const CONTAINER_DB = 'supabase_db_prontuario-medico';
const ID_MEDICO1 = 'a0000000-0000-0000-0000-000000000001';

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
}

function leitoUnico(): string {
  return `ADD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Consulta e alteração diretas no banco local (sem RLS), para preparar o cenário. */
function sqlLocal(sql: string): string {
  return execFileSync('docker', ['exec', CONTAINER_DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql], {
    encoding: 'utf8',
  }).trim();
}

async function clienteComo(email: string): Promise<SupabaseClient> {
  const cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } });
  const { error } = await cliente.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw error;
  return cliente;
}

/** Admite um paciente novo como medico1 (Cardiologia) e devolve o id da internação. */
async function admitirPaciente(page: Page, leito: string): Promise<string> {
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('link', { name: 'Admitir paciente' }).click();
  await page.getByLabel('Nome completo').fill(`Paciente adendo ${leito}`);
  await page.getByLabel('Data de nascimento').fill('1972-08-20');
  await page.getByLabel('Convênio').fill('SUS');
  await page.getByLabel('Equipe responsável').selectOption({ label: 'Cardiologia' });
  await page.getByLabel('Leito / ala').fill(leito);
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 });
  return new URL(page.url()).pathname.split('/').pop() as string;
}

/** Médico cria a evolução original e finaliza. */
async function medicoFinalizaOriginal(page: Page, id: string, evolucao: string) {
  await page.goto(`/internacoes/${id}`);
  await page.getByRole('link', { name: 'Nova evolução' }).click();
  await expect(page).toHaveURL(URL_EVOLUCAO);
  await page.getByLabel('Evolução clínica').fill(evolucao);
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta da original');
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalização' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO);
}

test('médico cria adendo e finaliza', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await medicoFinalizaOriginal(page, id, 'Evolução original do médico');

  await page.getByRole('button', { name: 'Adendo', exact: true }).click();
  await expect(page).toHaveURL(URL_EVOLUCAO);
  await expect(page.getByRole('heading', { name: TITULO_ADENDO })).toBeVisible();
  await page.getByText('Ver evolução original').click();
  await expect(page.getByText('Evolução original do médico')).toBeVisible();

  await page.getByLabel('Evolução clínica').fill('Complemento feito pelo adendo');
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta do adendo');
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Depois de finalizada a evolução não pode ser alterada');
  await page.getByRole('button', { name: 'Confirmar finalização' }).click();

  await expect(page).toHaveURL(URL_PRONTUARIO);
  await expect(page.getByTestId('rotulo-adendo')).toHaveCount(1);
  await expect(page.getByText('Complemento feito pelo adendo')).toBeVisible();
  expect(
    sqlLocal(`select count(*) from public.evolucoes where internacao_id = '${id}' and adendo_de is not null and status = 'FINALIZADA'`),
  ).toBe('1');
});

test('adendo em internação com alta', async ({ page }) => {
  const leito = leitoUnico();
  const id = await admitirPaciente(page, leito);
  await medicoFinalizaOriginal(page, id, 'Evolução antes da alta');
  sqlLocal(
    `update public.internacoes set status = 'ALTA', alta_em = now(), motivo_alta = 'Melhora clínica', alta_por = '${ID_MEDICO1}' where id = '${id}'`,
  );

  await page.goto('/anteriores');
  await page.getByRole('link', { name: new RegExp(`Paciente adendo ${leito}`) }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO);
  await expect(page.getByText('Internação com alta: prontuário somente para consulta.')).toBeVisible();

  await page.getByRole('button', { name: 'Adendo', exact: true }).click();
  await expect(page).toHaveURL(URL_EVOLUCAO);
  await expect(page.getByRole('heading', { name: TITULO_ADENDO })).toBeVisible();
  await page.getByLabel('Evolução clínica').fill('Adendo após a alta');
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta após a alta');
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalização' }).click();

  await expect(page).toHaveURL(URL_PRONTUARIO);
  await expect(page.getByText('Adendo após a alta')).toBeVisible();
});

test('recepção não vê botão Adendo', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await medicoFinalizaOriginal(page, id, 'Evolução que a recepção não vê');

  await page.context().clearCookies();
  await entrar(page, 'recepcao@teste.local');
  await page.goto(`/internacoes/${id}`);
  await expect(page.getByText('Conteúdo clínico disponível apenas para profissionais de saúde.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adendo', exact: true })).toHaveCount(0);
});

test('acadêmico cria adendo da própria evolução e envia para validação', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.context().clearCookies();

  await entrar(page, 'academico@teste.local');
  await page.goto(`/internacoes/${id}`);
  await page.getByRole('link', { name: 'Nova evolução' }).click();
  await page.getByLabel('Evolução clínica').fill('Evolução do acadêmico');
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta do acadêmico');
  await page.getByRole('button', { name: 'Enviar para validação', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar envio' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO);

  const evolucaoId = sqlLocal(
    `select id from public.evolucoes where internacao_id = '${id}' and status = 'AGUARDANDO_VALIDACAO'`,
  );
  const medico = await clienteComo('medico1@teste.local');
  const { error } = await medico.rpc('validar_evolucao', { p_evolucao_id: evolucaoId });
  expect(error).toBeNull();

  await page.context().clearCookies();
  await entrar(page, 'academico@teste.local');
  await page.goto(`/internacoes/${id}`);
  await page.getByRole('button', { name: 'Adendo', exact: true }).click();
  await expect(page).toHaveURL(URL_EVOLUCAO);
  await expect(page.getByRole('heading', { name: TITULO_ADENDO })).toBeVisible();
  await page.getByLabel('Evolução clínica').fill('Adendo do acadêmico');
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta do adendo do acadêmico');
  await page.getByRole('button', { name: 'Enviar para validação', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar envio' }).click();

  await expect(page).toHaveURL(URL_PRONTUARIO);
  await expect(page.getByText('Você tem uma evolução aguardando validação.')).toBeVisible();
  expect(
    sqlLocal(
      `select count(*) from public.evolucoes where internacao_id = '${id}' and adendo_de = '${evolucaoId}' and status = 'AGUARDANDO_VALIDACAO'`,
    ),
  ).toBe('1');
});
