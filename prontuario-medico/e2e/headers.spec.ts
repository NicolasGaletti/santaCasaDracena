import path from 'node:path'
import { expect, test, type APIResponse, type Page } from '@playwright/test'
import { anexarPeloCampo } from './helpers/anexos'
import { confirmarConclusao } from './helpers/conclusao'

const SENHA = 'Teste@123'
const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(#ficha)?$/
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
const FOTO = path.join(__dirname, 'fixtures', 'exame.jpg')

async function entrar(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail Profissional').fill(email)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click()
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible()
}

function diretivas(csp: string): Record<string, string[]> {
  const mapa: Record<string, string[]> = {}
  for (const parte of csp.split(';')) {
    const [nome, ...valores] = parte.trim().split(/\s+/)
    if (nome) mapa[nome] = valores
  }
  return mapa
}

// Em `next dev` o Next força "no-cache, must-revalidate" em páginas; no-store só vale em build de produção (projeto pwa).
function verificarNoStore(resposta: APIResponse) {
  const cc = resposta.headers()['cache-control'] ?? ''
  if (test.info().project.name === 'pwa' || !/no-cache, must-revalidate/.test(cc)) expect(cc).toContain('no-store')
}

function verificarHeaders(resposta: APIResponse) {
  const h = resposta.headers()
  const csp = diretivas(h['content-security-policy'] ?? '')
  expect(csp['default-src']).toEqual(["'self'"])
  expect(csp['connect-src']).toEqual(expect.arrayContaining(["'self'", 'https://*.supabase.co', 'wss://*.supabase.co']))
  expect(csp['img-src']).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:', 'https://*.supabase.co']))
  expect(csp['frame-ancestors']).toEqual(["'none'"])
  expect(csp['script-src']?.some((v) => v.startsWith("'nonce-"))).toBe(true)
  expect(h['strict-transport-security']).toBe('max-age=63072000; includeSubDomains')
  expect(h['x-frame-options']).toBe('DENY')
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(h['permissions-policy']).toBe('camera=(self), microphone=(), geolocation=()')
  expect(h['x-content-type-options']).toBe('nosniff')
}

test('headers de segurança em /login (sem no-store de página autenticada)', async ({ request }) => {
  const resposta = await request.get('/login')
  verificarHeaders(resposta)
})

test('nonce do CSP muda a cada requisição', async ({ request }) => {
  const nonce = async () =>
    diretivas((await request.get('/login')).headers()['content-security-policy'])['script-src'].find((v) =>
      v.startsWith("'nonce-"),
    )
  expect(await nonce()).not.toBe(await nonce())
})

test('páginas autenticadas e PDF: headers, no-store e sem violação de CSP', async ({ page }) => {
  const violacoes: string[] = []
  page.on('console', (m) => {
    if (/Content[- ]Security[- ]Policy|violates the following/i.test(m.text())) violacoes.push(m.text())
  })
  page.on('pageerror', (e) => violacoes.push(`pageerror: ${e.message}`))
  const respostasAction: APIResponse[] = []
  page.on('response', (r) => {
    if (r.request().method() === 'POST' && r.request().headers()['next-action']) respostasAction.push(r as unknown as APIResponse)
  })

  await page.goto('/login')
  await expect(page.getByLabel('E-mail Profissional')).toBeVisible()
  await entrar(page, 'medico1@teste.local')

  const lista = await page.request.get('/')
  verificarHeaders(lista)
  verificarNoStore(lista)

  await page.getByRole('link', { name: 'Admitir paciente' }).click()
  const leito = `HDR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  await page.getByLabel('Nome completo').fill(`Paciente Headers ${leito}`)
  await page.getByLabel('Data de nascimento').fill('1970-03-10')
  await page.getByLabel('Convênio').selectOption({ label: 'SUS' })
  await page.getByRole('radio', { name: 'Cardiologia' }).click()
  await page.getByLabel('Leito / ala').fill(leito)
  await page.getByRole('button', { name: 'Confirmar admissão' }).click()
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 })
  const urlProntuario = page.url()

  const prontuario = await page.request.get(urlProntuario)
  verificarHeaders(prontuario)
  verificarNoStore(prontuario)

  // Upload de anexo.
  await expect(page.getByLabel('Evolução clínica')).toBeVisible()
  await anexarPeloCampo(page, 'IMAGEM', FOTO)
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 })
  await expect(page.getByRole('img', { name: /Foto do anexo/ })).toBeVisible()

  await page.getByLabel('Evolução clínica').fill('Evolução para headers')
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta headers')
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await confirmarConclusao(page, 'finalizada')
  // A ficha recomeça vazia quando a conclusão termina: o diálogo some junto.
  await expect(page.getByRole('dialog')).toBeHidden()

  const href = await page.locator('a[href$="/pdf"]').first().getAttribute('href')
  const evolucaoId = href?.match(UUID)?.[0]
  expect(evolucaoId).toBeTruthy()

  const pdf = await page.request.get(`/evolucoes/${evolucaoId}/pdf`)
  expect(pdf.status()).toBe(200)
  verificarHeaders(pdf)
  expect(pdf.headers()['cache-control']).toBe('no-store')

  // Abre o PDF no navegador (visualizador/baixa); a navegação pode virar download.
  await page.goto(`/evolucoes/${evolucaoId}/pdf`).catch(() => undefined)

  expect(violacoes).toEqual([])

  // Resposta de server action (POST) também não pode ser cacheada.
  expect(respostasAction.length).toBeGreaterThan(0)
  if (test.info().project.name === 'pwa') {
    for (const r of respostasAction) expect(r.headers()['cache-control'] ?? '').toContain('no-store')
  }
})

test('assets estáticos e service worker não recebem no-store indevido', async ({ request }) => {
  const manifest = await request.get('/manifest.webmanifest')
  expect(manifest.headers()['cache-control'] ?? '').not.toContain('no-store')
  const sw = await request.get('/sw.js')
  expect(sw.headers()['cache-control']).toBe('no-cache, no-store, must-revalidate')
})

test('/offline (estática, fora do proxy) recebe CSP sem nonce', async ({ request }) => {
  const resposta = await request.get('/offline')
  expect(resposta.status()).toBe(200)
  const h = resposta.headers()
  const csp = diretivas(h['content-security-policy'] ?? '')
  expect(csp['script-src']).toEqual(["'self'", "'unsafe-inline'"])
  expect(csp['default-src']).toEqual(["'self'"])
  expect(csp['object-src']).toEqual(["'none'"])
  expect(csp['base-uri']).toEqual(["'self'"])
  expect(csp['form-action']).toEqual(["'self'"])
  expect(csp['frame-ancestors']).toEqual(["'none'"])
  expect(csp['worker-src']).toEqual(["'self'"])
  expect(csp['manifest-src']).toEqual(["'self'"])
  expect(csp['font-src']).toEqual(["'self'"])
  expect(csp['connect-src']).toEqual(expect.arrayContaining(["'self'", 'https://*.supabase.co']))
  expect(h['content-security-policy']).not.toContain('nonce-')
  expect(h['x-frame-options']).toBe('DENY')
})
