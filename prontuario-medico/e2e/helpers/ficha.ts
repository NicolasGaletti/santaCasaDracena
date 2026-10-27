import { expect, type Page } from '@playwright/test'

/** Abre a ficha de evolução: clica "Nova/Continuar evolução" se ela ainda está fechada (URL sem #ficha). */
export async function abrirFicha(page: Page) {
  const botao = page.getByRole('button', { name: /^(Nova|Continuar) evolução$/ })
  const ficha = page.locator('#ficha')
  await expect(botao.or(ficha)).toBeVisible({ timeout: 15_000 })
  // A ficha pode abrir sozinha (cópia local no IndexedDB) e tirar o botão no meio do clique.
  if (await botao.isVisible()) await botao.click({ timeout: 3_000 }).catch(() => {})
  await expect(ficha).toBeVisible()
}
