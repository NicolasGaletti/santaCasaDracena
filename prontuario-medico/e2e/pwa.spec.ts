import { expect, test, type Page } from '@playwright/test';

// Roda contra build de produção (projeto "pwa", porta 3100): em dev o shell não é pré-cacheado.
const SENHA = 'Teste@123';

async function swControlando(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('manifest válido', async ({ request }) => {
  const resp = await request.get('/manifest.webmanifest');
  expect(resp.status()).toBe(200);
  const m = await resp.json();
  expect(m.name).toBe('Prontuário Santa Casa');
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBe('/');
  const icones = m.icons as { src: string; sizes: string; purpose?: string }[];
  expect(icones.some((i) => i.sizes === '192x192' && (i.purpose ?? 'any') === 'any')).toBe(true);
  expect(icones.some((i) => i.sizes === '512x512' && (i.purpose ?? 'any') === 'any')).toBe(true);
  expect(icones.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
  for (const i of icones) {
    const r = await request.get(i.src);
    expect(r.status(), i.src).toBe(200);
    expect(r.headers()['content-type']).toContain('image/png');
  }
});

test('offline mostra página offline', async ({ page, context }) => {
  await page.goto('/login');
  await swControlando(page);
  await context.setOffline(true);
  await page.goto('/login');
  await expect(page.getByText('Sem conexão. Abra o app quando a rede voltar.')).toBeVisible();
  await context.setOffline(false);
});

test('script do service worker não fica em cache do navegador', async ({ request }) => {
  const resp = await request.get('/sw.js');
  expect(resp.status()).toBe(200);
  expect(resp.headers()['content-type']).toContain('javascript');
  expect(resp.headers()['cache-control']).toMatch(/no-cache|max-age=0/);
});

test('rotas de dados não ficam em cache', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill('medico1@teste.local');
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
  await swControlando(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
  await page.evaluate(async () => {
    await fetch('/api/qualquer').catch(() => null);
    await fetch('/evolucoes/x/pdf').catch(() => null);
    await fetch('/internacoes/x').catch(() => null);
  });
  const urls = await page.evaluate(async () => {
    const saida: string[] = [];
    for (const nome of await caches.keys()) {
      const cache = await caches.open(nome);
      for (const req of await cache.keys()) saida.push(new URL(req.url).pathname);
    }
    return saida;
  });
  expect(urls).toContain('/offline');
  for (const p of urls) {
    expect(p === '/offline' || p.startsWith('/_next/static/') || p.startsWith('/icons/'), p).toBe(true);
  }
});
