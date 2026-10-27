import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { PDFParse } from 'pdf-parse'
import { expect, test, type Page } from '@playwright/test'
import { anexarPeloCampo } from './helpers/anexos'
import { confirmarConclusao } from './helpers/conclusao'
import { abrirFicha } from './helpers/ficha'

const SENHA = 'Teste@123'
const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(#ficha)?$/
const FIXTURES = path.join(__dirname, 'fixtures')
const FOTO = path.join(FIXTURES, 'exame.jpg')
const PDF = path.join(FIXTURES, 'laudo.pdf')
const CONTAINER_DB = 'supabase_db_prontuario-medico'
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
  await page.getByLabel('Convênio').selectOption({ label: 'SUS' })
  await page.getByRole('radio', { name: 'Cardiologia' }).click()
  await page.getByLabel('Leito / ala').fill(leito)
  await page.getByRole('button', { name: 'Confirmar admissão' }).click()
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 })
  return new URL(page.url()).pathname.split('/').pop() as string
}

/** Cria e finaliza uma evolução médica; devolve o id (do link "Imprimir" no cartão). */
async function finalizarEvolucao(page: Page, internacaoId: string, texto: string): Promise<string> {
  await page.goto(`/internacoes/${internacaoId}`)
  await abrirFicha(page)
  await page.getByLabel('Evolução clínica').fill(texto)
  await page.getByRole('textbox', { name: 'Conduta' }).fill(`Conduta de ${texto}`)
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await confirmarConclusao(page, 'finalizada')
  // A ficha recomeça vazia quando a conclusão termina: o diálogo some junto.
  await expect(page.getByRole('dialog')).toBeHidden()
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
  expect(texto).toContain('Equipe responsável')
  expect(texto).not.toContain('Médico responsável')
})

test('PDF de rascunho responde 404', async ({ page }) => {
  const internacao = await admitirPaciente(page, leitoUnico())
  await page.goto(`/internacoes/${internacao}`)
  await abrirFicha(page)
  await page.getByLabel('Evolução clínica').fill('Rascunho que não pode ser impresso')
  await expect(page.getByText(/Salvo às/)).toBeVisible({ timeout: 10_000 })
  // Rascunho não aparece na timeline: o id vem do banco.
  const id = sqlLocal(`select id from public.evolucoes where internacao_id = '${internacao}' and status = 'RASCUNHO'`)
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

test('mesma chave de impressão repetida não gera nova via', async ({ page }) => {
  const internacao = await admitirPaciente(page, leitoUnico());
  const id = await finalizarEvolucao(page, internacao, 'Evolução para chave idempotente');
  const url = `/evolucoes/${id}/pdf?k=${crypto.randomUUID()}`;

  const primeira = await page.request.get(url);
  expect(await textoDoPdf(await primeira.body())).not.toContain('2ª via');

  const repetida = await page.request.get(url);
  expect(repetida.status()).toBe(200);
  expect(await textoDoPdf(await repetida.body())).not.toContain('2ª via');
})

/** Cria evolução com foto (Imagem, "Foto do exame") e PDF (Laboratório, "Hemograma completo") e finaliza. */
async function finalizarComAnexos(page: Page, internacaoId: string, texto: string): Promise<string> {
  await page.goto(`/internacoes/${internacaoId}`)
  await abrirFicha(page)
  await anexarPeloCampo(page, 'IMAGEM', FOTO, 'Foto do exame')
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 })
  await anexarPeloCampo(page, 'LABORATORIO', PDF, 'Hemograma completo')
  await expect(page.getByTestId('anexo-item')).toHaveCount(2, { timeout: 20_000 })
  await page.getByLabel('Evolução clínica').fill(texto)
  await page.getByRole('textbox', { name: 'Conduta' }).fill(`Conduta de ${texto}`)
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await confirmarConclusao(page, 'finalizada')
  // Finalizar com anexos leva mais que o padrão de 5 s sob carga (o botão fica desabilitado enquanto grava).
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 })
  const link = page.locator('a[href$="/pdf"]').first()
  await expect(link).toBeVisible()
  const id = (await link.getAttribute('href'))?.match(UUID)?.[0]
  if (!id) throw new Error('id da evolução não encontrado no link Imprimir')
  return id
}

test('PDF lista os anexos da evolução', async ({ page }) => {
  const internacao = await admitirPaciente(page, leitoUnico())
  const id = await finalizarComAnexos(page, internacao, 'Evolução com anexos')

  const resposta = await page.request.get(`/evolucoes/${id}/pdf`)
  expect(resposta.status()).toBe(200)
  const texto = await textoDoPdf(await resposta.body())
  expect(texto).toContain('Anexos')
  expect(texto).toContain('Laboratório')
  expect(texto).toContain('Hemograma completo')
  expect(texto).toContain('Página 1 de 1')
})

test('com anexos=1 o PDF tem página da imagem', async ({ page }) => {
  const internacao = await admitirPaciente(page, leitoUnico())
  const id = await finalizarComAnexos(page, internacao, 'Evolução com imagem no PDF')

  await page.goto(`/internacoes/${internacao}`)
  await expect(page.getByRole('link', { name: 'Imprimir com imagens' }).first()).toBeVisible()

  const semImagens = await page.request.get(`/evolucoes/${id}/pdf`)
  expect(await textoDoPdf(await semImagens.body())).toContain('Página 1 de 1')

  const comImagens = await page.request.get(`/evolucoes/${id}/pdf?anexos=1`)
  expect(comImagens.status()).toBe(200)
  const texto = await textoDoPdf(await comImagens.body())
  expect(texto).toMatch(/Imagem · \d{2}\/\d{2}\/\d{4} · Foto do exame/)
  expect(texto).toContain(`Evolução ${id.slice(0, 8).toUpperCase()}`)
  expect(texto).toContain('Página 1 de 2')
})

function sqlLocal(sql: string): string {
  return execFileSync('docker', ['exec', CONTAINER_DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql], {
    encoding: 'utf8',
  }).trim()
}

/** Médico da equipe valida a evolução pendente do leito pela tela de validação. */
async function medicoValida(page: Page, leito: string) {
  await page.context().clearCookies()
  await entrar(page, 'medico1@teste.local')
  await page.goto('/validacao')
  await page.getByRole('link', { name: new RegExp(`Paciente Impressão ${leito}`) }).click()
  await page.getByRole('button', { name: 'Validar', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar validação' }).click()
  // Só volta à lista depois que a validação foi gravada; antes disso a revisão não tem o link.
  await expect(page).toHaveURL(/\/validacao$/)
  await expect(page.getByRole('link', { name: new RegExp(`Paciente Impressão ${leito}`) })).toHaveCount(0)
}

test('PDF de evolução de acadêmico mostra Acadêmico(a) e validador', async ({ page }) => {
  const leito = leitoUnico()
  const internacao = await admitirPaciente(page, leito)
  await page.context().clearCookies()
  await entrar(page, 'academico@teste.local')
  await page.goto(`/internacoes/${internacao}`)
  await abrirFicha(page)
  await page.getByLabel('Evolução clínica').fill('Evolução do acadêmico')
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta do acadêmico')
  await page.getByRole('button', { name: 'Enviar para validação', exact: true }).click()
  await confirmarConclusao(page, 'enviada')
  // A ficha recomeça vazia quando a conclusão termina: o diálogo some junto.
  await expect(page.getByRole('dialog')).toBeHidden()

  await medicoValida(page, leito)
  const consultaId = `select id from public.evolucoes where internacao_id = '${internacao}' and status = 'FINALIZADA'`
  await expect.poll(() => sqlLocal(consultaId)).toMatch(UUID)
  const id = sqlLocal(consultaId)
  const resposta = await page.request.get(`/evolucoes/${id}/pdf`)
  expect(resposta.status()).toBe(200)
  const texto = await textoDoPdf(await resposta.body())
  expect(texto).toContain('EVOLUÇÃO MÉDICA DIÁRIA')
  expect(texto).toContain('Registrado por: Acadêmico Teste (teste) – Acadêmico(a) de Medicina')
  expect(texto).toContain('Validado por Dra. Marina Lopes (teste) – CRM 145892/SP')
  expect(texto.match(/Assinatura e carimbo do médico/g)).toHaveLength(1)
})

test('PDF de enfermagem validado pelo médico: título, Registrado por e Validado por', async ({ page }) => {
  const leito = leitoUnico()
  const internacao = await admitirPaciente(page, leito)
  await page.context().clearCookies()
  await entrar(page, 'enfermeira@teste.local')
  await page.goto(`/internacoes/${internacao}`)
  await abrirFicha(page)
  await page.locator('#ev-texto').fill('Paciente sem queixas de dor')
  await page.locator('#ev-plano').fill('Curativo a cada 24 horas')
  await page.getByRole('button', { name: 'Enviar para validação', exact: true }).click()
  await confirmarConclusao(page, 'enviada')
  // A ficha recomeça vazia quando a conclusão termina: o diálogo some junto.
  await expect(page.getByRole('dialog')).toBeHidden()

  await medicoValida(page, leito)
  const id = sqlLocal(`select id from public.evolucoes where internacao_id = '${internacao}' and status = 'FINALIZADA'`)
  const resposta = await page.request.get(`/evolucoes/${id}/pdf`)
  expect(resposta.status()).toBe(200)
  const texto = await textoDoPdf(await resposta.body())
  expect(texto).toContain('EVOLUÇÃO DE ENFERMAGEM')
  expect(texto).toContain('Registrado por: Enfermeira Teste (teste) – COREN 123456/SP')
  expect(texto).toContain('Validado por Dra. Marina Lopes (teste) – CRM 145892/SP')
  expect(texto).toContain('Paciente sem queixas de dor')
  expect(texto).toContain('Curativo a cada 24 horas')
})

test('PDF de adendo tem título com data e código da original', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico())
  const original = await finalizarEvolucao(page, id, 'Evolução original para adendo PDF')

  await page.getByRole('button', { name: 'Adendo', exact: true }).click()
  await page.getByLabel('Evolução clínica').fill('Complemento para o PDF do adendo')
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta do adendo para PDF')
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await confirmarConclusao(page, 'finalizada')
  // A ficha recomeça vazia quando a conclusão termina: o diálogo some junto.
  await expect(page.getByRole('dialog')).toBeHidden()

  const adendo = sqlLocal(`select id from public.evolucoes where adendo_de = '${original}' and status = 'FINALIZADA'`)
  const resposta = await page.request.get(`/evolucoes/${adendo}/pdf`)
  expect(resposta.status()).toBe(200)
  const texto = await textoDoPdf(await resposta.body())
  const codigo = original.slice(0, 8).toUpperCase()
  expect(texto).toMatch(new RegExp(`ADENDO À EVOLUÇÃO DE \\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2} \\(CÓDIGO ${codigo}\\)`))
  expect(texto).toContain('Complemento para o PDF do adendo')
})

test.describe('cartão com botões de impressão em viewport estreito', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('ações ficam no rodapé e o cartão não estoura a largura', async ({ page }) => {
    const internacao = await admitirPaciente(page, leitoUnico())
    await finalizarComAnexos(page, internacao, 'Evolução com layout estreito')

    await page.goto(`/internacoes/${internacao}`)
    const cartao = page.getByTestId('cartao-evolucao').first()
    const botao = cartao.getByRole('link', { name: 'Imprimir com imagens' })
    await expect(botao).toBeVisible()
    await expect(cartao.locator('footer').getByRole('link', { name: 'Imprimir com imagens' })).toBeVisible()

    const medidas = await cartao.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      direita: el.getBoundingClientRect().right,
    }))
    expect(medidas.scrollWidth).toBeLessThanOrEqual(medidas.clientWidth)
    expect(medidas.direita).toBeLessThanOrEqual(390)
    const larguraPagina = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }))
    expect(larguraPagina.scroll).toBeLessThanOrEqual(larguraPagina.janela)
  })
})
