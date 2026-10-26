import { expect, test, type Page } from '@playwright/test'

import { entrarAdmin } from './helpers/mfa'

const SENHA = 'Teste@123'

// Mutações compartilham o banco: em série.
test.describe.configure({ mode: 'serial' })

async function entrar(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail Profissional').fill(email)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click()
}

test('recepção não acessa /admin/convenios', async ({ page }) => {
  await entrar(page, 'recepcao@teste.local')
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible()
  await page.goto('/admin/convenios')
  await expect(page).not.toHaveURL(/\/admin/)
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible()
})

test.describe('admin', () => {
  test.skip(({ isMobile }) => isMobile, 'somente desktop')

  test('admin cria, renomeia e desativa convênio', async ({ page }) => {
    const nome = `Convênio E2E ${Math.random().toString(36).slice(2, 7)}`
    await entrarAdmin(page)
    await page.getByRole('navigation', { name: 'Administração' }).getByRole('link', { name: 'Convênios' }).click()
    await expect(page.getByRole('heading', { name: 'Convênios' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Particular' })).toContainText('Ativo')

    await page.getByRole('button', { name: 'Novo convênio' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Novo convênio' })
    await dialogo.getByLabel('Nome do convênio').fill(nome)
    await dialogo.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialogo).toBeHidden()
    const linha = page.getByRole('listitem').filter({ hasText: nome })
    await expect(linha).toContainText('Ativo')
    await expect(linha).toContainText('0 usos')

    // duplicado (sem diferenciar maiúsculas) mostra a mensagem do banco no diálogo
    await page.getByRole('button', { name: 'Novo convênio' }).click()
    await dialogo.getByLabel('Nome do convênio').fill(nome.toUpperCase())
    await dialogo.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialogo.getByRole('alert')).toHaveText('Já existe um convênio com esse nome.')
    await dialogo.getByRole('button', { name: 'Cancelar' }).click()

    await linha.getByRole('button', { name: 'Renomear' }).click()
    const renomear = page.getByRole('dialog', { name: 'Renomear convênio' })
    await renomear.getByLabel('Nome do convênio').fill(`${nome} B`)
    await renomear.getByRole('button', { name: 'Salvar' }).click()
    const renomeado = page.getByRole('listitem').filter({ hasText: `${nome} B` })
    await expect(renomeado).toBeVisible()

    await renomeado.getByRole('button', { name: 'Desativar' }).click()
    await expect(renomeado).toContainText('Desativado')
    await renomeado.getByRole('button', { name: 'Reativar' }).click()
    await expect(renomeado).toContainText('Ativo')
    await renomeado.getByRole('button', { name: 'Desativar' }).click()
    await expect(renomeado).toContainText('Desativado')
  })
})
