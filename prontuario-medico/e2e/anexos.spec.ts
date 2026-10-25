import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const SENHA = 'Teste@123';
const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FIXTURES = path.join(__dirname, 'fixtures');
const FOTO = path.join(FIXTURES, 'exame.jpg');
const PDF = path.join(FIXTURES, 'laudo.pdf');

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
}

/** Alertas da aplicação; exclui o anunciador de rota do Next, que também usa role="alert". */
function alertas(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

function leitoUnico(): string {
  return `E2E-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function admitirPaciente(page: Page, leito: string): Promise<string> {
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('link', { name: 'Admitir paciente' }).click();
  await page.getByLabel('Nome completo').fill(`Paciente E2E ${leito}`);
  await page.getByLabel('Data de nascimento').fill('1970-03-10');
  await page.getByLabel('Convênio').fill('SUS');
  await page.getByLabel('Equipe responsável').selectOption({ label: 'Cardiologia' });
  await page.getByLabel('Leito / ala').fill(leito);
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 });
  return new URL(page.url()).pathname.split('/').pop() as string;
}

/** Abre um rascunho novo e a seção Exames, onde fica o bloco de anexos. */
async function abrirExamesDeRascunho(page: Page, id: string) {
  await page.goto(`/internacoes/${id}`);
  await page.getByRole('link', { name: 'Nova evolução' }).click();
  await expect(page).toHaveURL(/\/evolucao$/);
  await expect(page.getByLabel('Evolução clínica')).toBeVisible();
  await page.getByRole('button', { name: 'Exames', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anexos' })).toBeVisible();
}

async function anexarFoto(page: Page) {
  await page.getByTestId('entrada-foto').setInputFiles(FOTO);
}

async function finalizarEvolucao(page: Page, evolucao: string, conduta: string) {
  await page.getByLabel('Evolução clínica').fill(evolucao);
  await page.getByRole('textbox', { name: 'Conduta' }).fill(conduta);
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Depois de finalizada a evolução não pode ser alterada');
  await page.getByRole('button', { name: 'Confirmar finalização' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO);
}

test('médico anexa foto e ela aparece na lista', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);

  await anexarFoto(page);

  const item = page.getByTestId('anexo-item');
  await expect(item).toHaveCount(1, { timeout: 20_000 });
  await expect(item).toContainText('Outro');
  await expect(page.getByRole('img', { name: /Foto do anexo/ })).toBeVisible();
});

test('anexa PDF de laudo', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);

  await page.getByRole('radio', { name: 'Laboratório' }).click();
  await page.getByLabel('Descrição').fill('Hemograma completo');
  await page.getByTestId('entrada-arquivo').setInputFiles(PDF);

  const item = page.getByTestId('anexo-item');
  await expect(item).toHaveCount(1, { timeout: 20_000 });
  await expect(item).toContainText('Laboratório');
  await expect(item).toContainText('Hemograma completo');
  await expect(item.getByTestId('icone-pdf')).toBeVisible();
});

test('remove anexo antes de finalizar', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);
  await anexarFoto(page);
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 });

  await page.getByRole('button', { name: 'Remover', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remover anexo', exact: true }).click();

  await expect(page.getByTestId('anexo-item')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Exames', exact: true }).click();
  await expect(page.getByTestId('anexo-item')).toHaveCount(0);
});

test('após finalizar não há botão remover', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);
  await anexarFoto(page);
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 });

  await finalizarEvolucao(page, 'Evolução com anexo', 'Conduta com anexo');

  await expect(page.getByRole('button', { name: 'Remover', exact: true })).toHaveCount(0);
});

test('sem conexão mostra mensagem e permite tentar de novo', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);

  await page.route('**/storage/v1/object/**', (r) => r.abort());
  await anexarFoto(page);
  await expect(page.getByText('Sem conexão. Tente enviar o anexo novamente.')).toBeVisible({ timeout: 20_000 });

  await page.unroute('**/storage/v1/object/**');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByText('Sem conexão. Tente enviar o anexo novamente.')).toHaveCount(0);
});

test('descarta rascunho com foto anexada', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);
  await anexarFoto(page);
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 });

  await page.getByRole('button', { name: 'Descartar rascunho', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar rascunho', exact: true }).click();

  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 });
  await expect(alertas(page)).toHaveCount(0);
});
