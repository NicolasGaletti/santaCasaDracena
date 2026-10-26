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
  await gravarChave(page, 'rascunho:i-1:u-1', { dados: {}, textoLivre: 'segredo', sincronizado: true });
  await gravarChave(page, 'rascunho:i-2:u-1', { dados: {}, textoLivre: 'outro', sincronizado: true });
  expect((await listarChaves(page)).filter((c) => c.startsWith('rascunho:'))).toHaveLength(2);

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);
  expect((await listarChaves(page)).filter((c) => c.startsWith('rascunho:'))).toEqual([]);
});

test('login mostra aviso de sessão expirada por inatividade', async ({ page }) => {
  await page.goto('/login?motivo=inatividade');
  await expect(page.locator('p[role="alert"]')).toHaveText('Sua sessão expirou por inatividade.');
});

const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function abrirEvolucaoNova(page: Page) {
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('link', { name: 'Admitir paciente' }).click();
  const leito = `E2E-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  await page.getByLabel('Nome completo').fill(`Paciente E2E ${leito}`);
  await page.getByLabel('Data de nascimento').fill('1970-03-10');
  await page.getByLabel('Convênio').selectOption({ label: 'SUS' });
  await page.getByRole('radio', { name: 'Cardiologia' }).click();
  await page.getByLabel('Leito / ala').fill(leito);
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 });
  await expect(page.getByLabel('Evolução clínica')).toBeVisible();
}

test('Sair com rascunho não sincronizado pede confirmação e mantém a cópia local', async ({ page }) => {
  await abrirEvolucaoNova(page);
  // Só o salvamento do rascunho falha (a saída da sessão precisa de rede); sem evento `online` que reenvie sozinho.
  await page.route('**/rest/v1/rpc/salvar_rascunho', (r) => r.abort('internetdisconnected'));
  await page.getByLabel('Evolução clínica').fill('Rascunho que não chegou ao servidor');

  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toContainText('Há alterações que ainda não foram salvas no servidor.', { timeout: 15_000 });

  await dialogo.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.locator('#ficha')).toBeVisible();
  expect((await listarChaves(page)).filter((c) => c.startsWith('rascunho:'))).toHaveLength(1);

  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(dialogo).toBeVisible({ timeout: 15_000 });
  await dialogo.getByRole('button', { name: 'Sair mesmo assim' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Um rascunho não sincronizado ficou guardado neste aparelho e será enviado quando você entrar de novo.')).toBeVisible();
  expect((await listarChaves(page)).filter((c) => c.startsWith('rascunho:'))).toHaveLength(1);
});
