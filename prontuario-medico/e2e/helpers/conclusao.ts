import { expect, type Page } from '@playwright/test'

const AVISOS = {
  finalizada: 'Evolução finalizada.',
  enviada: 'Evolução enviada para validação.',
} as const

/** Botão de confirmação do diálogo: "Finalizar" (dentro do diálogo) ou "Confirmar envio". */
export function botaoConfirmar(page: Page, acao: 'finalizada' | 'enviada') {
  return acao === 'finalizada'
    ? page.getByRole('dialog').getByRole('button', { name: 'Finalizar', exact: true })
    : page.getByRole('button', { name: 'Confirmar envio' })
}

/**
 * Clica em "Finalizar" (no diálogo)/"Confirmar envio": a conclusão leva à lista de Internados com o aviso.
 * Depois volta ao prontuário de origem, para os testes que seguem dali.
 */
export async function confirmarConclusao(page: Page, acao: 'finalizada' | 'enviada', opcoes: { voltar?: boolean } = {}) {
  const origem = page.url()
  await botaoConfirmar(page, acao).click()
  await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 20_000 })
  await expect(page.getByText(AVISOS[acao])).toBeVisible()
  if (opcoes.voltar !== false) await page.goto(origem)
}
