import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { confirmarConclusao } from './helpers/conclusao'
import { abrirFicha } from './helpers/ficha'

const SENHA = 'Teste@123'
const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(#ficha)?$/
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/

async function admitirPaciente(page: Page): Promise<string> {
  const leito = `REA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  await page.goto('/login')
  await page.getByLabel('E-mail Profissional').fill('medico1@teste.local')
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click()
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible()
  await page.getByRole('link', { name: 'Admitir paciente' }).click()
  await page.getByLabel('Nome completo').fill(`Paciente reabrir ${leito}`)
  await page.getByLabel('Data de nascimento').fill('1971-04-12')
  await page.getByLabel('Convênio').selectOption({ label: 'SUS' })
  await page.getByRole('radio', { name: 'Cardiologia' }).click()
  await page.getByLabel('Leito / ala').fill(leito)
  await page.getByRole('button', { name: 'Confirmar admissão' }).click()
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 })
  return new URL(page.url()).pathname.split('/').pop() as string
}

async function finalizar(page: Page, evolucao: string) {
  await page.getByLabel('Evolução clínica').fill(evolucao)
  await page.getByRole('textbox', { name: 'Conduta' }).fill(`Conduta de ${evolucao}`)
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await confirmarConclusao(page, 'finalizada', { voltar: false })
}

test('finalizar, reabrir, editar e finalizar de novo', async ({ page }) => {
  const internacao = await admitirPaciente(page)
  await page.goto(`/internacoes/${internacao}`)
  await abrirFicha(page)
  await finalizar(page, 'Texto original')

  // O aviso da lista oferece "Reabrir" e leva ao prontuário (mesma ação nunca é chamada direto do toast).
  await page.getByRole('button', { name: 'Reabrir', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/internacoes/${internacao}`))

  await expect(page.getByText(/disponível até \d{2}:\d{2}/)).toBeVisible()
  await page.getByRole('button', { name: 'Reabrir para editar' }).click()
  await expect(page.getByLabel('Evolução clínica')).toHaveValue('Texto original', { timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Reabrir para editar' })).toHaveCount(0)

  await finalizar(page, 'Texto corrigido')
  await page.goto(`/internacoes/${internacao}`)
  await expect(page.getByTestId('cartao-evolucao')).toHaveCount(1)
  await expect(page.getByTestId('cartao-evolucao')).toContainText('Texto corrigido')
  await expect(page.getByRole('button', { name: 'Reabrir para editar' })).toBeVisible()
})

test('depois de imprimir não há mais Reabrir para editar', async ({ page }) => {
  const internacao = await admitirPaciente(page)
  await page.goto(`/internacoes/${internacao}`)
  await abrirFicha(page)
  await finalizar(page, 'Texto para imprimir')
  await page.goto(`/internacoes/${internacao}`)
  await expect(page.getByRole('button', { name: 'Reabrir para editar' })).toBeVisible()

  const id = (await page.locator('a[href$="/pdf"]').first().getAttribute('href'))?.match(UUID)?.[0]
  expect(id).toBeTruthy()
  const resposta = await page.request.get(`/evolucoes/${id}/pdf?k=${randomUUID()}`)
  expect(resposta.status()).toBe(200)

  await page.reload()
  await expect(page.getByTestId('cartao-evolucao')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Reabrir para editar' })).toHaveCount(0)
})
