import { expect, test } from '@playwright/test';

const SENHA = 'Teste@123';

async function entrar(page: import('@playwright/test').Page, email: string, senha: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill(email);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
}

test('visitante é redirecionado para /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login\?next=%2F$/);
});

test('login inválido mostra erro', async ({ page }) => {
  await entrar(page, 'medico1@teste.local', 'senha-errada');
  await expect(page.locator('p[role="alert"]')).toHaveText('E-mail ou senha inválidos.');
  await expect(page).toHaveURL(/\/login/);
});

test('medico1 entra e vê "Internados"', async ({ page }) => {
  await entrar(page, 'medico1@teste.local', SENHA);
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
});

test('sair volta para /login', async ({ page }) => {
  await entrar(page, 'medico1@teste.local', SENHA);
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);
});
