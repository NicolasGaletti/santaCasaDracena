import { expect, test, type Page } from '@playwright/test'

const SENHA = 'Teste@123'

// Telas de administração (Plano 4, Task 5). Mutações compartilham o banco: em série.
test.describe.configure({ mode: 'serial' })

async function entrar(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail Profissional').fill(email)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click()
}

test('médico não acessa /admin', async ({ page }) => {
  await entrar(page, 'medico1@teste.local')
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Administração/ })).toHaveCount(0)
  await page.goto('/admin/profissionais')
  await expect(page).not.toHaveURL(/\/admin/)
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible()
  await page.goto('/admin/equipes')
  await expect(page).not.toHaveURL(/\/admin/)
})

test.describe('admin', () => {
  test.skip(({ isMobile }) => isMobile, 'somente desktop')

  test('admin vai direto para a administração, sem abas clínicas', async ({ page }) => {
    await entrar(page, 'admin@teste.local')
    await expect(page).toHaveURL(/\/admin\/profissionais$/)
    await expect(page.getByRole('heading', { name: 'Profissionais' })).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Principal' })
    await expect(nav.getByRole('link', { name: 'Administração' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Internados' })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'Imprimir' })).toHaveCount(0)
    for (const rota of ['/', '/imprimir', '/anteriores', '/validacao']) {
      await page.goto(rota)
      await expect(page).toHaveURL(/\/admin\/profissionais$/)
    }
  })

  test('admin convida enfermeira com COREN sugerido', async ({ page }) => {
    const sufixo = Math.random().toString(36).slice(2, 8)
    const nome = `Enfermeira Convidada ${sufixo} (teste)`
    await entrar(page, 'admin@teste.local')
    await page.getByRole('button', { name: 'Convidar profissional' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Convidar profissional' })
    await dialogo.getByLabel('Nome').fill(nome)
    await dialogo.getByLabel('E-mail').fill(`enf-${sufixo}@teste.local`)

    // sem função escolhida e para recepção não há conselho
    await expect(dialogo.getByLabel('Conselho')).toHaveCount(0)
    await dialogo.getByRole('combobox', { name: 'Função' }).click()
    await page.getByRole('option', { name: 'Recepção' }).click()
    await expect(dialogo.getByLabel('Conselho')).toHaveCount(0)

    await dialogo.getByRole('combobox', { name: 'Função' }).click()
    await page.getByRole('option', { name: 'Enfermagem' }).click()
    await expect(dialogo.getByLabel('Conselho')).toHaveValue('COREN')
    await dialogo.getByLabel('Número').fill('778899')
    await dialogo.getByLabel('UF').fill('SP')
    await dialogo.getByRole('checkbox', { name: 'Cardiologia' }).check()
    await dialogo.getByRole('button', { name: 'Enviar convite' }).click()

    await expect(dialogo).toBeHidden()
    await page.getByLabel('Buscar profissional').fill(sufixo)
    const linha = page.getByRole('listitem').filter({ hasText: nome })
    await expect(linha).toBeVisible()
    await expect(linha).toContainText('Enfermagem')
    await expect(linha).toContainText('COREN 778899/SP')
    await expect(linha).toContainText('Cardiologia')
    await expect(linha).toContainText('Convite pendente')
    await expect(linha.getByRole('button', { name: 'Reenviar convite' })).toBeVisible()

    // e-mail repetido: mensagem clara, nada duplicado
    await page.getByRole('button', { name: 'Convidar profissional' }).click()
    await dialogo.getByLabel('Nome').fill('Duplicado (teste)')
    await dialogo.getByLabel('E-mail').fill('medico1@teste.local')
    await dialogo.getByRole('combobox', { name: 'Função' }).click()
    await page.getByRole('option', { name: 'Interno' }).click()
    await dialogo.getByRole('button', { name: 'Enviar convite' }).click()
    await expect(dialogo.getByRole('alert')).toHaveText('Este e-mail já está cadastrado.')
  })

  test('admin cria equipe e vincula', async ({ page }) => {
    const nomeEquipe = `Equipe E2E ${Math.random().toString(36).slice(2, 7)}`
    await entrar(page, 'admin@teste.local')
    await page.getByRole('navigation', { name: 'Administração' }).getByRole('link', { name: 'Equipes' }).click()
    await expect(page.getByRole('heading', { name: 'Equipes' })).toBeVisible()

    await page.getByRole('button', { name: 'Nova equipe' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Nova equipe' })
    await dialogo.getByLabel('Nome da equipe').fill(nomeEquipe)
    await dialogo.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialogo).toBeHidden()

    const cartao = page.getByRole('listitem').filter({ hasText: nomeEquipe })
    await expect(cartao).toBeVisible()
    await cartao.getByRole('button', { name: 'Membros' }).click()
    await cartao.getByRole('combobox', { name: 'Adicionar membro' }).click()
    await page.getByRole('option', { name: /Enfermeira Teste/ }).click()
    await expect(cartao.getByRole('list', { name: 'Membros' })).toContainText('Enfermeira Teste (teste)')

    // o vínculo aparece na lista de profissionais
    await page.goto('/admin/profissionais')
    await page.getByLabel('Buscar profissional').fill('Enfermeira Teste')
    await expect(page.getByRole('listitem').filter({ hasText: 'Enfermeira Teste (teste)' })).toContainText(nomeEquipe)

    // desfaz: remove o membro, renomeia e desativa
    await page.goto('/admin/equipes')
    const mesmo = page.getByRole('listitem').filter({ hasText: nomeEquipe })
    await mesmo.getByRole('button', { name: 'Membros' }).click()
    await mesmo.getByRole('button', { name: /Remover Enfermeira Teste/ }).click()
    await expect(mesmo.getByRole('list', { name: 'Membros' })).toHaveCount(0)
    await mesmo.getByRole('button', { name: 'Renomear' }).click()
    const renomear = page.getByRole('dialog', { name: 'Renomear equipe' })
    await renomear.getByLabel('Nome da equipe').fill(`${nomeEquipe} B`)
    await renomear.getByRole('button', { name: 'Salvar' }).click()
    const renomeada = page.getByRole('listitem').filter({ hasText: `${nomeEquipe} B` })
    await expect(renomeada).toBeVisible()
    await renomeada.getByRole('button', { name: 'Desativar' }).click()
    await expect(renomeada).toContainText('Inativa')
  })

  test('admin desativa e usuário perde acesso', async ({ page, browser }) => {
    const nome = 'Recepção Desativável (teste)'
    const contexto = await browser.newContext()
    const usuario = await contexto.newPage()
    try {
      await entrar(usuario, 'desativavel@teste.local')
      await expect(usuario.getByRole('heading', { name: 'Internados' })).toBeVisible()

      await entrar(page, 'admin@teste.local')
      await page.getByLabel('Buscar profissional').fill('Desativável')
      const linha = page.getByRole('listitem').filter({ hasText: nome })
      await expect(linha).toContainText('Ativo')
      await linha.getByRole('button', { name: 'Desativar' }).click()
      const confirma = page.getByRole('dialog', { name: 'Desativar profissional' })
      await confirma.getByRole('button', { name: 'Confirmar desativação' }).click()
      await expect(linha).toContainText('Desativado')

      await usuario.goto('/')
      await expect(usuario).toHaveURL(/\/login/)

      await linha.getByRole('button', { name: 'Reativar' }).click()
      await page.getByRole('dialog', { name: 'Reativar profissional' }).getByRole('button', { name: 'Confirmar reativação' }).click()
      await expect(linha).toContainText('Ativo')
      await entrar(usuario, 'desativavel@teste.local')
      await expect(usuario.getByRole('heading', { name: 'Internados' })).toBeVisible()
    } finally {
      await contexto.close()
    }
  })

  test('admin não vê a própria desativação', async ({ page }) => {
    await entrar(page, 'admin@teste.local')
    await page.getByLabel('Buscar profissional').fill('Admin Teste')
    const eu = page.getByRole('listitem').filter({ hasText: 'Admin Teste' })
    await expect(eu).toBeVisible()
    await expect(eu.getByRole('button', { name: 'Desativar' })).toHaveCount(0)
  })
})
