import { expect, test, type Page } from '@playwright/test';

const SENHA = 'Teste@123';

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
}

/** Grava/lê direto no IndexedDB do idb-keyval (banco "keyval-store", store "keyval"). */
async function gravarChave(page: Page, chave: string, valor: unknown) {
  await page.evaluate(
    ([c, v]) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('keyval-store');
        req.onupgradeneeded = () => req.result.createObjectStore('keyval');
        req.onsuccess = () => {
          const tx = req.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(v, c);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    [chave, valor] as const,
  );
}

async function listarChaves(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const req = indexedDB.open('keyval-store');
        req.onupgradeneeded = () => req.result.createObjectStore('keyval');
        req.onsuccess = () => {
          const r = req.result.transaction('keyval', 'readonly').objectStore('keyval').getAllKeys();
          r.onsuccess = () => resolve(r.result.map(String));
          r.onerror = () => reject(r.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
}

test('logout limpa cópias locais', async ({ page }) => {
  await entrar(page, 'medico1@teste.local');
  await gravarChave(page, 'rascunho:i-1:u-1', { dados: {}, textoLivre: 'segredo' });
  await gravarChave(page, 'rascunho:i-2:u-1', { dados: {}, textoLivre: 'outro' });
  expect((await listarChaves(page)).filter((c) => c.startsWith('rascunho:'))).toHaveLength(2);

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);
  expect((await listarChaves(page)).filter((c) => c.startsWith('rascunho:'))).toEqual([]);
});

test('login mostra aviso de sessão expirada por inatividade', async ({ page }) => {
  await page.goto('/login?motivo=inatividade');
  await expect(page.locator('p[role="alert"]')).toHaveText('Sua sessão expirou por inatividade.');
});
