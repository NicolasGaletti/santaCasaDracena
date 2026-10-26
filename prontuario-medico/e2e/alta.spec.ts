import { PDFParse } from 'pdf-parse'
import { expect, test, type Page } from '@playwright/test'

const SENHA = 'Teste@123'
const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

async function entrar(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail Profissional').fill(email)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click()
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible()
}

function leitoUnico(): string {
  return `ALT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

/** Admite um paciente novo como medico1 (Cardiologia) e devolve o id da internação. */
async function admitirPaciente(page: Page, leito: string): Promise<string> {
  await entrar(page, 'medico1@teste.local')
  await page.getByRole('link', { name: 'Admitir paciente' }).click()
  await page.getByLabel('Nome completo').fill(`Paciente Alta ${leito}`)
  await page.getByLabel('Data de nascimento').fill('1965-05-02')
  await page.getByLabel('Convênio').fill('SUS')
  await page.getByLabel('Equipe responsável').selectOption({ label: 'Cardiologia' })
  await page.getByLabel('Leito / ala').fill(leito)
  await page.getByRole('button', { name: 'Confirmar admissão' }).click()
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 })
  return new URL(page.url()).pathname.split('/').pop() as string
}

async function darAlta(page: Page, resumo: string) {
  await page.getByRole('button', { name: 'Dar alta' }).click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toContainText('Depois da alta, a internação fica somente leitura.')
  await dialogo.getByRole('radio', { name: 'Melhorada' }).check()
  await dialogo.getByLabel('Resumo da alta').fill(resumo)
  await dialogo.getByRole('button', { name: 'Confirmar alta' }).click()
}

async function textoDoPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  const resultado = await parser.getText()
  await parser.destroy()
  return resultado.text
}

test('médico dá alta e paciente vai para Anteriores', async ({ page }) => {
  const leito = leitoUnico()
  await admitirPaciente(page, leito)

  await darAlta(page, 'Paciente estável, segue em acompanhamento ambulatorial.')
  await expect(page.getByText('Internação com alta: prontuário somente para consulta.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dar alta' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Folha de alta (PDF)' })).toBeVisible()

  await page.goto('/anteriores')
  const cartao = page.locator('li', { hasText: `Paciente Alta ${leito}` })
  await expect(cartao).toBeVisible()
  await expect(cartao).toContainText('Melhorada')
  await expect(cartao).toContainText(/Alta em \d{2}\/\d{2}\/\d{4}/)
})

test('alta recusada mostra a mensagem do banco', async ({ page }) => {
  await admitirPaciente(page, leitoUnico())
  await page.getByRole('button', { name: 'Dar alta' }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByRole('radio', { name: 'Curada' }).check()
  await dialogo.getByLabel('Data e hora da alta').fill('2020-01-01T08:00')
  await dialogo.getByLabel('Resumo da alta').fill('Resumo qualquer')
  await dialogo.getByRole('button', { name: 'Confirmar alta' }).click()
  await expect(dialogo.getByRole('alert')).toHaveText('A data da alta não pode ser anterior à admissão.')
  await expect(dialogo).toBeVisible()
})

test('folha de alta em PDF', async ({ page }) => {
  const leito = leitoUnico()
  const id = await admitirPaciente(page, leito)

  const antes = await page.request.get(`/internacoes/${id}/alta/pdf`)
  expect(antes.status()).toBe(404)

  await darAlta(page, 'Resumo clínico da alta para a folha.')
  await expect(page.getByRole('link', { name: 'Folha de alta (PDF)' })).toBeVisible()

  const resposta = await page.request.get(`/internacoes/${id}/alta/pdf`)
  expect(resposta.status()).toBe(200)
  expect(resposta.headers()['content-type']).toContain('application/pdf')
  expect(resposta.headers()['cache-control']).toContain('no-store')
  const texto = await textoDoPdf(await resposta.body())
  expect(texto).toContain('FOLHA DE ALTA')
  expect(texto).toContain(`Paciente Alta ${leito}`)
  expect(texto).toContain('Melhorada')
  expect(texto).toContain('Resumo clínico da alta para a folha.')
  expect(texto).toContain('Alta dada por Dra. Marina Lopes (teste) – CRM 145892/SP')
  expect(texto).toContain('Assinatura e carimbo do médico')
  expect(texto).not.toMatch(/ª via/)

  const semSessao = await page.context().browser()!.newContext({ baseURL: 'http://localhost:3000' })
  const anonimo = await semSessao.request.get(`/internacoes/${id}/alta/pdf`, { maxRedirects: 0 })
  expect(anonimo.status()).toBe(307)
  expect(anonimo.headers()['location']).toContain('/login')
  await semSessao.close()
})

test('recepção não vê Dar alta nem baixa a folha', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico())
  await darAlta(page, 'Alta para teste de recepção.')
  await expect(page.getByRole('link', { name: 'Folha de alta (PDF)' })).toBeVisible()

  await page.context().clearCookies()
  await entrar(page, 'recepcao@teste.local')
  await page.goto(`/internacoes/${id}`)
  await expect(page.getByRole('link', { name: 'Folha de alta (PDF)' })).toHaveCount(0)
  const resposta = await page.request.get(`/internacoes/${id}/alta/pdf`)
  expect(resposta.status()).toBe(403)
})

test('recepção não vê Dar alta', async ({ page }) => {
  await admitirPaciente(page, leitoUnico())
  const url = page.url()
  await page.context().clearCookies()
  await entrar(page, 'recepcao@teste.local')
  await page.goto(url)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dar alta' })).toHaveCount(0)
})
