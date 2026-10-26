import { expect, test, type Page } from '@playwright/test';

const SENHA = 'Teste@123';

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
}

test('médico não acessa /auditoria', async ({ page }) => {
  await entrar(page, 'medico1@teste.local');
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Auditoria' })).toHaveCount(0);
  await page.goto('/auditoria');
  await expect(page).not.toHaveURL(/\/auditoria/);
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
});

test('auditoria vê acessos de prontuário', async ({ page, browser }) => {
  // Médico abre um prontuário (gera um acesso).
  const ctxMedico = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const paginaMedico = await ctxMedico.newPage();
  await entrar(paginaMedico, 'medico1@teste.local');
  await expect(paginaMedico.getByRole('heading', { name: 'Internados' })).toBeVisible();
  await paginaMedico.locator('a[href^="/internacoes/"]:not([href$="/nova"])').first().click();
  await expect(paginaMedico).toHaveURL(/\/internacoes\/[0-9a-f-]{36}$/);
  await ctxMedico.close();

  await entrar(page, 'auditoria@teste.local');
  await page.getByRole('link', { name: 'Auditoria' }).first().click();
  await expect(page).toHaveURL(/\/auditoria/);
  await expect(page.getByRole('heading', { name: 'Auditoria' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Acessos' })).toHaveAttribute('aria-current', 'page');
  const linha = page.getByRole('row').filter({ hasText: 'Dra. Marina Lopes (teste)' }).filter({ hasText: 'Abriu o prontuário' }).first();
  await expect(linha).toBeVisible();

  // Filtro por profissional sem acessos esvazia a lista.
  await page.getByLabel('Profissional', { exact: true }).selectOption({ label: 'Dr. Felipe Ramos (teste)' });
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL(/profissional=/);
  await expect(page.getByRole('row').filter({ hasText: 'Dra. Marina Lopes (teste)' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Limpar' }).click();
  await expect(page).not.toHaveURL(/profissional=/);
  await page.getByRole('link', { name: 'Alterações' }).click();
  await expect(page).toHaveURL(/aba=alteracoes/);
  await expect(page.getByRole('columnheader', { name: 'Resumo' })).toBeVisible();
});
