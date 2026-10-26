import { expect, type Page } from '@playwright/test';

export type TipoCampo = 'ECG' | 'IMAGEM' | 'LABORATORIO';

/** Abre "Anexar" do campo e envia o arquivo; o tipo do anexo vem do campo. */
export async function anexarPeloCampo(page: Page, tipo: TipoCampo, arquivo: string, descricao?: string) {
  await page.getByTestId(`anexos-${tipo}`).getByRole('button', { name: /^Anexar/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  if (descricao) await page.getByLabel('Descrição').fill(descricao);
  await page.getByTestId(arquivo.endsWith('.pdf') ? 'entrada-arquivo' : 'entrada-foto').setInputFiles(arquivo);
}
