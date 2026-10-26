import { expect, test, type Page } from '@playwright/test';

const SENHA = 'Teste@123';
const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
}

function leitoUnico(): string {
  return `PRO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Admite um paciente como medico1 (Cardiologia); devolve o id da internação. */
async function admitirPaciente(page: Page, leito: string, nome = `Paciente Prontuario ${leito}`): Promise<string> {
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('link', { name: 'Admitir paciente' }).click();
  await page.getByLabel('Nome completo').fill(nome);
  await page.getByLabel('Data de nascimento').fill('1960-02-11');
  await page.getByLabel('Convênio').fill('SUS');
  await page.getByLabel('Equipe responsável').selectOption({ label: 'Cardiologia' });
  await page.getByLabel('Leito / ala').fill(leito);
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 });
  return new URL(page.url()).pathname.split('/').pop() as string;
}

test('prontuário mostra cabeçalho, barra de ações, ficha e histórico na mesma página', async ({ page }) => {
  const leito = leitoUnico();
  const id = await admitirPaciente(page, leito);
  await page.goto(`/internacoes/${id}`);

  const cabecalho = page.locator('[data-slot="cabecalho-paciente"]');
  await expect(cabecalho.getByRole('heading', { level: 1 })).toContainText(`Paciente Prontuario ${leito}`);
  await expect(page.locator('[data-slot="barra-acoes"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dar alta' })).toBeVisible();
  // Ficha inline: sem botão de largura total "Nova evolução".
  await expect(page.locator('#ficha').getByLabel('Evolução clínica')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nova evolução' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Evoluções' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'ECG' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Imagem' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Laboratório' })).toBeVisible();
  // Ordem: cabeçalho, barra, ficha, histórico.
  const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
  const ys = [await y('[data-slot="cabecalho-paciente"]'), await y('[data-slot="barra-acoes"]'), await y('#ficha'), await y('[data-slot="abas-coloridas"]')];
  expect([...ys].sort((a, b) => a - b)).toEqual(ys);
});

test('abas do histórico: ECG mostra o ECG do dia e anexos ECG', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  await page.getByLabel('Evolução clínica').fill('Evolução com ECG');
  await page.getByRole('textbox', { name: 'ECG' }).fill('Ritmo sinusal sem alterações do ST');
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Manter conduta');
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalização' }).click();
  await expect(page.getByTestId('cartao-evolucao')).toHaveCount(1);

  await page.getByRole('tab', { name: 'ECG' }).click();
  const painel = page.getByRole('tabpanel');
  await expect(painel).toContainText('Ritmo sinusal sem alterações do ST');
  await expect(painel).not.toContainText('Evolução com ECG');
  await page.getByRole('tab', { name: 'Imagem' }).click();
  await expect(page.getByRole('tabpanel')).not.toContainText('Ritmo sinusal');
});

test('abas operáveis por teclado', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  const evolucoes = page.getByRole('tab', { name: 'Evoluções' });
  await evolucoes.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'ECG' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'ECG' })).toHaveAttribute('aria-selected', 'true');
});

test('link antigo /evolucao?adendo=… abre a ficha de adendo no prontuário', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}/evolucao?adendo=abc123`);
  await expect(page).toHaveURL(new RegExp(`/internacoes/${id}\\?adendo=abc123#ficha$`));
  await expect(page.locator('#ficha').getByLabel('Evolução clínica')).toBeVisible();
});

test('360px sem rolagem horizontal com nome e evolução longos', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const nomeLongo = 'Maria Aparecida da Conceição Albuquerque de Vasconcelos Figueiredo Santos Neto';
  const id = await admitirPaciente(page, 'Enfermaria Clínica B · 12', nomeLongo);
  await page.goto(`/internacoes/${id}`);
  await page.getByLabel('Evolução clínica').fill('Texto longo '.repeat(170) + 'palavrasemquebra'.repeat(12));
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta');
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalização' }).click();
  await expect(page.getByTestId('cartao-evolucao')).toHaveCount(1);

  const medidas = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(medidas.scroll).toBeLessThanOrEqual(medidas.client);
});

test('Dar alta continua só para médico da equipe', async ({ page, browser }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  await expect(page.getByRole('button', { name: 'Dar alta' })).toBeVisible();

  const outro = await browser.newPage();
  await entrar(outro, 'medico2@teste.local');
  await outro.goto(`/internacoes/${id}`);
  await expect(outro.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(outro.getByRole('button', { name: 'Dar alta' })).toHaveCount(0);
  await outro.close();

  const recepcao = await browser.newPage();
  await entrar(recepcao, 'recepcao@teste.local');
  await recepcao.goto(`/internacoes/${id}`);
  await expect(recepcao.getByRole('button', { name: 'Dar alta' })).toHaveCount(0);
  await recepcao.close();
});

test('leito é texto no cabeçalho e troca pelo botão; rodapé e ações têm alvos de 44px', async ({ page }) => {
  const leito = leitoUnico();
  const id = await admitirPaciente(page, leito);
  await page.goto(`/internacoes/${id}`);

  await expect(page.locator('[data-slot="cabecalho-paciente"] [data-slot="leito-texto"]')).toHaveText(leito);
  await expect(page.getByLabel('Leito / ala')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Trocar leito' })).toBeEnabled();

  const alturas: number[] = [];
  for (const nome of ['Salvar', 'Finalizar', 'Dar alta']) {
    const caixa = await page.getByRole('button', { name: nome, exact: true }).boundingBox();
    expect(caixa, nome).not.toBeNull();
    alturas.push(caixa!.height);
  }
  const mobile = (page.viewportSize()?.width ?? 1280) < 640;
  if (mobile) for (const h of alturas) expect(h).toBeGreaterThanOrEqual(44);
});
