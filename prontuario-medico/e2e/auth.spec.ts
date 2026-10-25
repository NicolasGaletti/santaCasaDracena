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

test('usuário inativo vê mensagem de cadastro', async ({ page }) => {
  await entrar(page, 'inativo@teste.local', SENHA);
  await expect(page).toHaveURL(/\/login\?error=sem_cadastro/);
  await expect(page.locator('p[role="alert"]')).toHaveText(
    'Seu usuário não tem cadastro profissional ativo. Procure o administrador.',
  );
});

test('login redireciona para next', async ({ page }) => {
  await page.goto('/?x=1');
  await expect(page).toHaveURL(/\/login\?next=%2F%3Fx%3D1$/);
  await page.getByLabel('E-mail Profissional').fill('medico1@teste.local');
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page).toHaveURL(/\/\?x=1$/);
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
});

test('e-mail digitado é mantido após erro de login', async ({ page }) => {
  await entrar(page, 'medico1@teste.local', 'senha-errada');
  await expect(page.locator('p[role="alert"]')).toHaveText('E-mail ou senha inválidos.');
  await expect(page.getByLabel('E-mail Profissional')).toHaveValue('medico1@teste.local');
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
