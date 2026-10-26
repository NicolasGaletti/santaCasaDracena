import { expect, test, type Page } from '@playwright/test'

const SENHA = 'Teste@123'
const LEITO_LONGO = 'Enfermaria Clínica B · 12'

async function entrar(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail Profissional').fill(email)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click()
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible()
}

async function admitir(page: Page, nome: string, leito: string, equipe: string) {
  await page.getByRole('link', { name: 'Admitir paciente' }).click()
  await page.getByLabel('Nome completo').fill(nome)
  await page.getByLabel('Data de nascimento').fill('1960-01-15')
  await page.getByLabel('Convênio').selectOption({ label: 'SUS' })
  await page.getByRole('radio', { name: equipe }).click()
  await page.getByLabel('Leito / ala').fill(leito)
  await page.getByRole('button', { name: 'Confirmar admissão' }).click()
  await expect(page).toHaveURL(/\/internacoes\/[0-9a-f-]{36}$/, { timeout: 20_000 })
}

test('360px sem rolagem horizontal com leito e nome longos; leito não sai do quadro', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  const nome = `Maria Aparecida dos Santos Albuquerque de Oliveira Menezes ${Date.now()}`
  await entrar(page, 'medico1@teste.local')
  await admitir(page, nome, LEITO_LONGO, 'Cardiologia')
  await page.goto('/')

  const cartao = page.getByTestId('cartao-internacao').filter({ hasText: nome })
  await expect(cartao).toBeVisible()

  const pagina = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }))
  expect(pagina.sw).toBeLessThanOrEqual(pagina.cw)

  const quadro = cartao.getByTestId('leito-cartao')
  await expect(quadro).toHaveAttribute('title', LEITO_LONGO)
  const estoura = await quadro.evaluate((el) => {
    const caixa = el.getBoundingClientRect()
    const filhos = [el, ...Array.from(el.querySelectorAll('*'))] as HTMLElement[]
    return filhos.some((f) => {
      const r = f.getBoundingClientRect()
      return f.scrollWidth > f.clientWidth + 1 || r.right > caixa.right + 1 || r.bottom > caixa.bottom + 1
    })
  })
  expect(estoura).toBe(false)
})

test('navegação principal cabe em 360px sem rolagem, com alvos de 44px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await entrar(page, 'medico1@teste.local')
  const nav = page.getByRole('navigation', { name: 'Principal' })
  const dados = await nav.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }))
  expect(dados.sw).toBeLessThanOrEqual(dados.cw)
  const links = nav.getByRole('link')
  expect(await links.count()).toBeGreaterThanOrEqual(4)
  for (const link of await links.all()) {
    const caixa = await link.boundingBox()
    expect(caixa!.height).toBeGreaterThanOrEqual(44)
    expect(caixa!.x).toBeGreaterThanOrEqual(0)
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(360)
  }
  await expect(nav.getByRole('link', { name: 'Imprimir' })).toBeVisible()
  await expect(nav.locator('[aria-current="page"]')).toContainText('Internados')
})

test('filtro de equipe continua funcionando', async ({ page }) => {
  await entrar(page, 'medico1@teste.local')
  const nome = `Paciente Filtro ${Date.now()}`
  await admitir(page, nome, 'FLT-1', 'Cardiologia')
  await page.goto('/')
  const filtro = page.getByRole('navigation', { name: 'Filtrar por equipe' })
  await filtro.getByRole('link', { name: 'Nefrologia' }).click()
  await expect(page).toHaveURL(/equipe=/)
  await expect(page.getByTestId('cartao-internacao').filter({ hasText: nome })).toHaveCount(0)
  await filtro.getByRole('link', { name: 'Cardiologia' }).click()
  await expect(page.getByTestId('cartao-internacao').filter({ hasText: nome })).toBeVisible()
  await filtro.getByRole('link', { name: 'Todas as equipes' }).click()
  await expect(page.getByTestId('cartao-internacao').filter({ hasText: nome })).toBeVisible()
})
