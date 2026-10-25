import { PDFParse } from 'pdf-parse'
import { expect, test, type Page } from '@playwright/test'

const SENHA = 'Teste@123'
const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/

async function entrar(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail Profissional').fill(email)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click()
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible()
}

function leitoUnico(): string {
  return `IMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

async function admitirPaciente(page: Page, leito: string): Promise<string> {
  await entrar(page, 'medico1@teste.local')
  await page.getByRole('link', { name: 'Admitir paciente' }).click()
  await page.getByLabel('Nome completo').fill(`Paciente Impressão ${leito}`)
  await page.getByLabel('Data de nascimento').fill('1970-03-10')
  await page.getByLabel('Convênio').fill('SUS')
  await page.getByLabel('Equipe').selectOption({ label: 'Cardiologia' })
  await page.getByLabel('Leito / ala').fill(leito)
  await page.getByLabel('Médico responsável').selectOption({ label: 'Dra. Marina Lopes (teste)' })
  await page.getByRole('button', { name: 'Confirmar admissão' }).click()
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 })
  return new URL(page.url()).pathname.split('/').pop() as string
}

/** Cria e finaliza uma evolução médica; devolve o id (do link "Imprimir" no cartão). */
async function finalizarEvolucao(page: Page, internacaoId: string, texto: string): Promise<string> {
  await page.goto(`/internacoes/${internacaoId}`)
  await page.getByRole('link', { name: 'Nova evolução' }).click()
  await expect(page).toHaveURL(/\/evolucao$/)
  await page.getByLabel('Evolução clínica').fill(texto)
  await page.getByRole('textbox', { name: 'Conduta' }).fill(`Conduta de ${texto}`)
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar finalização' }).click()
  await expect(page).toHaveURL(URL_PRONTUARIO)
  const link = page.locator('a[href$="/pdf"]').first()
  await expect(link).toBeVisible()
  const id = (await link.getAttribute('href'))?.match(UUID)?.[0]
  if (!id) throw new Error('id da evolução não encontrado no link Imprimir')
  return id
}

async function textoDoPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  const resultado = await parser.getText()
  await parser.destroy()
  return resultado.text
}

test('PDF de finalizada responde 200 application/pdf', async ({ page }) => {
  const leito = leitoUnico()
  const internacao = await admitirPaciente(page, leito)
  const id = await finalizarEvolucao(page, internacao, 'Evolução para PDF')

  const resposta = await page.request.get(`/evolucoes/${id}/pdf`)
  expect(resposta.status()).toBe(200)
  expect(resposta.headers()['content-type']).toContain('application/pdf')
  expect(resposta.headers()['cache-control']).toBe('no-store')
  expect(resposta.headers()['content-disposition']).toBe(
    `inline; filename="evolucao-${id.slice(0, 8).toUpperCase()}.pdf"`,
  )
  const texto = await textoDoPdf(await resposta.body())
  expect(texto).toContain(`Paciente Impressão ${leito}`)
  expect(texto).toContain('Validado por Dra. Marina Lopes (teste) – CRM 145892/SP')
})

test('PDF de rascunho responde 404', async ({ page }) => {
  const internacao = await admitirPaciente(page, leitoUnico())
  await page.goto(`/internacoes/${internacao}`)
  await page.getByRole('link', { name: 'Nova evolução' }).click()
  await page.getByLabel('Evolução clínica').fill('Rascunho que não pode ser impresso')
  await expect(page.getByText(/Salvo às/)).toBeVisible({ timeout: 10_000 })
  await page.goto(`/internacoes/${internacao}`)
  const cartao = page.getByTestId('cartao-evolucao').first()
  const id = (await cartao.locator('h3').getAttribute('id'))?.replace('evolucao-', '')
  if (!id) throw new Error('id do rascunho não encontrado')

  const resposta = await page.request.get(`/evolucoes/${id}/pdf`)
  expect(resposta.status()).toBe(404)
})

test('segunda impressão marca 2ª via', async ({ page }) => {
  const internacao = await admitirPaciente(page, leitoUnico())
  const id = await finalizarEvolucao(page, internacao, 'Evolução para duas vias')

  const primeira = await page.request.get(`/evolucoes/${id}/pdf`)
  expect(await textoDoPdf(await primeira.body())).not.toContain('2ª via')

  const segunda = await page.request.get(`/evolucoes/${id}/pdf`)
  expect(segunda.status()).toBe(200)
  expect(await textoDoPdf(await segunda.body())).toContain('2ª via')
})

test('PDF sem autenticação responde 401', async ({ request }) => {
  const resposta = await request.get('/evolucoes/d0000000-0000-0000-0000-000000000001/pdf', {
    maxRedirects: 0,
  })
  expect(resposta.status()).toBe(401)
})

test('lote de 2 evoluções: cada uma tem sua própria paginação', async ({ page }) => {
  const internacao = await admitirPaciente(page, leitoUnico())
  const primeira = await finalizarEvolucao(page, internacao, 'Primeira evolução do lote')
  const segunda = await finalizarEvolucao(page, internacao, 'Segunda evolução do lote')

  const resposta = await page.request.get(`/evolucoes/lote/pdf?ids=${primeira},${segunda}`)
  expect(resposta.status()).toBe(200)
  const paginacao = (await textoDoPdf(await resposta.body())).match(/Página \d+ de \d+/g)
  expect(paginacao).toEqual(['Página 1 de 1', 'Página 1 de 1'])
})

test('recepção não gera PDF: 403', async ({ page }) => {
  await entrar(page, 'recepcao@teste.local')
  const resposta = await page.request.get('/evolucoes/d0000000-0000-0000-0000-000000000001/pdf')
  expect(resposta.status()).toBe(403)
})

test('/imprimir lista a finalizada e ela some depois de impressa', async ({ page }) => {
  const leito = leitoUnico()
  const internacao = await admitirPaciente(page, leito)
  await finalizarEvolucao(page, internacao, 'Evolução para fila de impressão')

  await page.goto('/imprimir')
  const linha = page.locator('li', { hasText: `Paciente Impressão ${leito}` })
  await expect(linha).toBeVisible()

  await linha.getByRole('checkbox').check()
  // Popup com noopener não expõe a URL de imediato: a requisição do PDF é o que importa.
  const respostaPdf = page.context().waitForEvent('response', (r) => r.url().includes('/evolucoes/lote/pdf?ids='))
  await page.getByRole('button', { name: 'Imprimir selecionadas' }).click()
  const resposta = await respostaPdf
  expect(resposta.status()).toBe(200)
  expect(resposta.headers()['content-type']).toContain('application/pdf')

  await expect(async () => {
    await page.reload()
    await expect(page.locator('li', { hasText: `Paciente Impressão ${leito}` })).toHaveCount(0)
  }).toPass({ timeout: 15_000 })
})
