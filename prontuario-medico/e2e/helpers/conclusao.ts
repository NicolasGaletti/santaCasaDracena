import { expect, type Page } from '@playwright/test'

const AVISOS = {
  finalizada: 'Evolução finalizada.',
  enviada: 'Evolução enviada para validação.',
} as const

/**
 * Clica em "Confirmar finalização"/"Confirmar envio": a conclusão leva à lista de Internados com o aviso.
 * Depois volta ao prontuário de origem, para os testes que seguem dali.
 */
export async function confirmarConclusao(page: Page, acao: 'finalizada' | 'enviada', opcoes: { voltar?: boolean } = {}) {
  const origem = page.url()
  await page.getByRole('button', { name: acao === 'finalizada' ? 'Confirmar finalização' : 'Confirmar envio' }).click()
  await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 20_000 })
  await expect(page.getByText(AVISOS[acao])).toBeVisible()
  if (opcoes.voltar !== false) await page.goto(origem)
}
