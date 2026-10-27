import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { anexarPeloCampo } from './helpers/anexos';
import { confirmarConclusao } from './helpers/conclusao';

const SENHA = 'Teste@123';
const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FIXTURES = path.join(__dirname, 'fixtures');
const FOTO = path.join(FIXTURES, 'exame.jpg');
const PDF = path.join(FIXTURES, 'laudo.pdf');

// Ambiente local do Supabase (`supabase status`). Chave publicável, não é segredo.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_CHAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const CONTAINER_DB = 'supabase_db_prontuario-medico';

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
}

/** Alertas da aplicação; exclui o anunciador de rota do Next, que também usa role="alert". */
function alertas(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

function leitoUnico(): string {
  return `E2E-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function admitirPaciente(page: Page, leito: string): Promise<string> {
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('link', { name: 'Admitir paciente' }).click();
  await page.getByLabel('Nome completo').fill(`Paciente E2E ${leito}`);
  await page.getByLabel('Data de nascimento').fill('1970-03-10');
  await page.getByLabel('Convênio').selectOption({ label: 'SUS' });
  await page.getByRole('radio', { name: 'Cardiologia' }).click();
  await page.getByLabel('Leito / ala').fill(leito);
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 });
  return new URL(page.url()).pathname.split('/').pop() as string;
}

/** Abre um rascunho novo: os campos de exame e seus anexos já ficam visíveis. */
async function abrirExamesDeRascunho(page: Page, id: string) {
  await page.goto(`/internacoes/${id}`);
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.getByLabel('Evolução clínica')).toBeVisible();
}

async function anexarFoto(page: Page) {
  await anexarPeloCampo(page, 'IMAGEM', FOTO);
}

async function finalizarEvolucao(page: Page, evolucao: string, conduta: string) {
  await page.getByLabel('Evolução clínica').fill(evolucao);
  await page.getByRole('textbox', { name: 'Conduta' }).fill(conduta);
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Depois de finalizada, a evolução não pode mais ser alterada');
  await confirmarConclusao(page, 'finalizada');
  // A ficha recomeça vazia quando a conclusão termina: o diálogo some junto.
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** Cliente Supabase como o médico (sessão própria, sem service_role). */
async function clienteComo(email: string): Promise<SupabaseClient> {
  const cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } });
  const { error } = await cliente.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw error;
  return cliente;
}

/** Consulta direta ao banco local: o objeto do Storage existe mesmo sem linha visível via RLS. */
function sqlLocal(sql: string): string {
  return execFileSync('docker', ['exec', CONTAINER_DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql], {
    encoding: 'utf8',
  }).trim();
}

function objetoExiste(caminho: string): boolean {
  return sqlLocal(`select count(*) from storage.objects where bucket_id = 'anexos' and name = '${caminho}'`) === '1';
}

function linhaExiste(anexoId: string): boolean {
  return sqlLocal(`select count(*) from public.anexos where id = '${anexoId}'`) === '1';
}

/** Primeira linha de uma consulta; falha clara se vier vazia. */
function primeira<T>(linhas: T[] | null): T {
  if (!linhas || linhas.length === 0) throw new Error('consulta sem linhas');
  return linhas[0];
}

/** Imagem terminou de carregar (blob local ou URL assinada do servidor). */
async function imagemCarregada(img: Locator) {
  await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
}

test('médico anexa foto e ela aparece na lista', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);

  await anexarFoto(page);

  const item = page.getByTestId('anexo-item');
  await expect(item).toHaveCount(1, { timeout: 20_000 });
  await expect(item).toContainText('Imagem');
  await expect(page.getByTestId('anexos-IMAGEM').getByTestId('anexo-item')).toHaveCount(1);
  await expect(page.getByRole('img', { name: /Foto do anexo/ })).toBeVisible();

  // Persistido: depois de recarregar a lista vem do servidor, com prévia por URL assinada.
  await page.reload();
  await expect(page.getByTestId('anexo-item')).toHaveCount(1);
  await imagemCarregada(page.getByRole('img', { name: /Foto do anexo/ }));
});

test('anexar mostra confirmação, atualiza a lista e limpa o formulário', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);

  const lab = page.getByTestId('anexos-LABORATORIO');
  await expect(lab.getByTestId('anexo-item')).toHaveCount(0);
  await expect(lab.getByText('Nenhum anexo.')).toHaveCount(0);

  const painel = page.getByRole('dialog', { name: 'Anexar Laboratório' });
  await lab.getByRole('button', { name: /^Anexar/ }).click();
  await expect(painel).toBeVisible();
  // O tipo vem do campo: não há escolha de tipo no painel.
  await expect(painel.getByRole('radio')).toHaveCount(0);
  await page.getByLabel('Descrição').fill('Hemograma de admissão');
  await page.getByTestId('entrada-foto').setInputFiles(FOTO);

  await expect(painel).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: 'Anexo adicionado.' })).toBeVisible({ timeout: 20_000 });
  await expect(lab.getByTestId('anexo-item')).toContainText('Hemograma de admissão');

  // Reabrir começa limpo: descrição vazia, data de hoje.
  await lab.getByRole('button', { name: /^Anexar/ }).click();
  await expect(painel).toBeVisible();
  await expect(page.getByLabel('Descrição')).toHaveValue('');
  await expect(page.getByLabel('Data do exame')).toHaveValue(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
  );

  await page.getByLabel('Descrição').fill('Outro hemograma');
  await page.getByTestId('entrada-arquivo').setInputFiles(PDF);
  await expect(painel).toBeHidden();
  const itens = lab.getByTestId('anexo-item');
  await expect(itens).toHaveCount(2, { timeout: 20_000 });
  await expect(itens.filter({ hasText: 'Hemograma de admissão' })).toHaveCount(1);
  await expect(itens.filter({ hasText: 'Outro hemograma' })).toHaveCount(1);
});

test('anexo pelo campo Laboratório sai como LABORATORIO e aparece sob o campo', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);

  await anexarPeloCampo(page, 'LABORATORIO', FOTO, 'Gasometria');
  const sob = page.getByTestId('anexos-LABORATORIO').getByTestId('anexo-item');
  await expect(sob).toHaveCount(1, { timeout: 20_000 });
  await expect(sob).toContainText('Laboratório');
  await expect(page.getByTestId('anexos-ECG').getByTestId('anexo-item')).toHaveCount(0);
  await expect(page.getByTestId('anexos-IMAGEM').getByTestId('anexo-item')).toHaveCount(0);

  expect(sqlLocal(`select tipo from public.anexos where internacao_id = '${id}'`)).toBe('LABORATORIO');
});

test('ECG aceita anexo', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);

  await anexarPeloCampo(page, 'ECG', PDF, 'ECG de entrada');
  const sob = page.getByTestId('anexos-ECG').getByTestId('anexo-item');
  await expect(sob).toHaveCount(1, { timeout: 20_000 });
  await expect(sob).toContainText('ECG');
  expect(sqlLocal(`select tipo from public.anexos where internacao_id = '${id}'`)).toBe('ECG');
});

test('rascunho com anexo OUTRO antigo mostra "Outros anexos" e permite remover', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);
  await anexarFoto(page);
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 });
  // Anexo antigo: o envio novo nunca sai como OUTRO, então reclassifica a linha direto no banco.
  sqlLocal(`update public.anexos set tipo = 'OUTRO' where internacao_id = '${id}'`);
  await page.reload();

  const outros = page.getByTestId('anexos-OUTRO');
  await expect(outros).toContainText('Outros anexos');
  await expect(outros.getByTestId('anexo-item')).toHaveCount(1);
  await expect(outros.getByTestId('anexo-item')).toContainText('Outro');
  await expect(outros.getByRole('button', { name: /^Anexar/ })).toHaveCount(0);

  await outros.getByRole('button', { name: 'Remover', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remover anexo', exact: true }).click();
  await expect(page.getByTestId('anexo-item')).toHaveCount(0);
  await expect(page.getByTestId('anexos-OUTRO')).toHaveCount(0);
  expect(sqlLocal(`select count(*) from public.anexos where internacao_id = '${id}'`)).toBe('0');
});

test('anexa PDF de laudo', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);

  await anexarPeloCampo(page, 'LABORATORIO', PDF, 'Hemograma completo');

  const item = page.getByTestId('anexo-item');
  await expect(item).toHaveCount(1, { timeout: 20_000 });
  await expect(item).toContainText('Laboratório');
  await expect(item).toContainText('Hemograma completo');
  await expect(item.getByTestId('icone-pdf')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('anexo-item')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Abrir PDF' })).toBeVisible();
});

test('remove anexo antes de finalizar', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);
  await anexarFoto(page);
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 });

  const medico = await clienteComo('medico1@teste.local');
  const anexo = primeira((await medico.from('anexos').select('id, storage_path').eq('internacao_id', id)).data);
  
  await page.getByRole('button', { name: 'Remover', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remover anexo', exact: true }).click();

  await expect(page.getByTestId('anexo-item')).toHaveCount(0);
  expect(objetoExiste(anexo.storage_path)).toBe(false);
  expect(linhaExiste(anexo.id)).toBe(false);

  await page.reload();
  await expect(page.getByTestId('anexo-item')).toHaveCount(0);
});

test('após finalizar não há botão remover e o anexo fica imutável', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);
  await anexarFoto(page);
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 });

  const medico = await clienteComo('medico1@teste.local');
  const anexo = primeira((await medico.from('anexos').select('id, storage_path').eq('internacao_id', id)).data);
  
  await finalizarEvolucao(page, 'Evolução com anexo', 'Conduta com anexo');
  await expect(page.getByRole('button', { name: 'Remover', exact: true })).toHaveCount(0);

  // Remoção direta pelo banco é negada após finalizar.
  const { error: erroRpc } = await medico.rpc('remover_anexo', { p_anexo_id: anexo.id });
  expect(erroRpc).not.toBeNull();
  expect(erroRpc?.code).toBe('P0001');
  expect(linhaExiste(anexo.id)).toBe(true);

  // E o objeto no Storage continua no lugar.
  const { data: removidos } = await medico.storage.from('anexos').remove([anexo.storage_path]);
  expect(removidos ?? []).toHaveLength(0);
  expect(objetoExiste(anexo.storage_path)).toBe(true);
});

test('sem conexão mostra mensagem e permite tentar de novo', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);

  await page.route('**/storage/v1/object/**', (r) => r.abort());
  await anexarFoto(page);
  await expect(page.getByText('Sem conexão. Tente enviar o anexo novamente.')).toBeVisible({ timeout: 20_000 });

  await page.unroute('**/storage/v1/object/**');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByText('Sem conexão. Tente enviar o anexo novamente.')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('anexo-item')).toHaveCount(1);
  await imagemCarregada(page.getByRole('img', { name: /Foto do anexo/ }));
});

test('finalizar com anexo não enviado é bloqueado e mostra o aviso', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);

  await page.route('**/storage/v1/object/**', (r) => r.abort());
  await anexarFoto(page);
  await expect(page.getByText('Sem conexão. Tente enviar o anexo novamente.')).toBeVisible({ timeout: 20_000 });

  await page.getByLabel('Evolução clínica').fill('Evolução com anexo pendente');
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta de teste');
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();

  await expect(page.getByText('Há anexo não enviado. Envie de novo ou cancele antes de finalizar.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#ficha')).toBeVisible();
});

test('descarta rascunho mesmo se o objeto já sumiu do Storage', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);
  await anexarFoto(page);
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 });

  const medico = await clienteComo('medico1@teste.local');
  const rascunho = primeira((await medico.from('evolucoes').select('id').eq('internacao_id', id).eq('status', 'RASCUNHO')).data);
  const anexo = primeira((await medico.from('anexos').select('id, storage_path').eq('evolucao_id', rascunho.id)).data);
  // Objeto apagado direto no Storage pelo próprio autor do rascunho.
  const { data: apagados } = await medico.storage.from('anexos').remove([anexo.storage_path]);
  expect(apagados).toHaveLength(1);
  expect(objetoExiste(anexo.storage_path)).toBe(false);

  await page.getByRole('button', { name: 'Descartar rascunho', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar rascunho', exact: true }).click();

  // Sem rascunho, a ficha recomeça vazia e o botão de descartar some.
  await expect(page.getByRole('button', { name: 'Descartar rascunho' })).toHaveCount(0, { timeout: 20_000 });
  await expect(alertas(page)).toHaveCount(0);
  expect(linhaExiste(anexo.id)).toBe(false);
});

test('descarta rascunho com foto anexada e limpa linha e objeto', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);
  await anexarFoto(page);
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 });

  const medico = await clienteComo('medico1@teste.local');
  const rascunho = primeira((await medico.from('evolucoes').select('id').eq('internacao_id', id).eq('status', 'RASCUNHO')).data);
  const anexo = primeira((await medico.from('anexos').select('id, storage_path').eq('evolucao_id', rascunho.id)).data);
    expect(objetoExiste(anexo.storage_path)).toBe(true);

  await page.getByRole('button', { name: 'Descartar rascunho', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar rascunho', exact: true }).click();

  // Sem rascunho, a ficha recomeça vazia e o botão de descartar some.
  await expect(page.getByRole('button', { name: 'Descartar rascunho' })).toHaveCount(0, { timeout: 20_000 });
  await expect(alertas(page)).toHaveCount(0);
  expect(linhaExiste(anexo.id)).toBe(false);
  expect(objetoExiste(anexo.storage_path)).toBe(false);
});

/** Admite, anexa foto (Imagem) e PDF (ECG) no rascunho e finaliza. Devolve o id da internação. */
async function criarExamesFinalizados(page: Page): Promise<string> {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);
  await anexarFoto(page);
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 });
  await anexarPeloCampo(page, 'ECG', PDF);
  await expect(page.getByTestId('anexo-item')).toHaveCount(2, { timeout: 20_000 });
  await finalizarEvolucao(page, 'Evolução com exames', 'Conduta com exames');
  return id;
}

async function abrirAbaExames(page: Page, id: string, aba: 'ECG' | 'Imagem' | 'Laboratório' = 'Imagem') {
  await page.goto(`/internacoes/${id}`);
  await page.getByRole('tab', { name: aba }).click();
  await expect(page.getByTestId('galeria-item').first()).toBeVisible({ timeout: 20_000 });
}

test('galeria mostra anexo da evolução finalizada', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await abrirExamesDeRascunho(page, id);
  await anexarFoto(page);
  await expect(page.getByTestId('anexo-item')).toHaveCount(1, { timeout: 20_000 });
  await finalizarEvolucao(page, 'Evolução com foto', 'Conduta com foto');

  await abrirAbaExames(page, id);
  await expect(page.getByTestId('galeria-item')).toHaveCount(1);
  await expect(page.getByTestId('galeria-item')).toContainText('Imagem');
  await imagemCarregada(page.getByRole('img', { name: /Foto do anexo/ }));
});

test('cada aba mostra só os anexos do seu tipo e o PDF abre em nova aba', async ({ page }) => {
  const id = await criarExamesFinalizados(page);
  await abrirAbaExames(page, id, 'ECG');

  const itens = page.getByTestId('galeria-item');
  await expect(itens).toHaveCount(1);
  await expect(itens).toContainText('ECG');

  await page.getByRole('tab', { name: 'Imagem' }).click();
  await expect(itens).toHaveCount(1);
  await expect(itens).toContainText('Imagem');

  await page.getByRole('tab', { name: 'Laboratório' }).click();
  await expect(itens).toHaveCount(0);

  await page.getByRole('tab', { name: 'ECG' }).click();
  // O navegador headless não renderiza PDF em nova aba: confere a abertura e a URL assinada pedida.
  const [nova, pedidoAssinado] = await Promise.all([
    page.waitForEvent('popup'),
    page.context().waitForEvent('request', (r) => r.url().includes('/storage/v1/object/sign/anexos/')),
    itens.getByRole('button', { name: /Abrir PDF/ }).click(),
  ]);
  expect(nova).toBeTruthy();
  expect(pedidoAssinado.url()).toMatch(/\/storage\/v1\/object\/sign\/anexos\//);
  // O acesso ao anexo fica registrado no log.
  expect(Number(sqlLocal(`select count(*) from public.acessos where acao = 'ver_anexo' and internacao_id = '${id}'`))).toBeGreaterThan(0);
});

test('visualizador em tela cheia fecha com Esc e com o voltar do navegador', async ({ page }) => {
  const id = await criarExamesFinalizados(page);
  await abrirAbaExames(page, id);
  await page.getByTestId('galeria-item').getByRole('button', { name: /Ampliar anexo/ }).click();
  const visualizador = page.getByRole('dialog');
  await expect(visualizador).toBeVisible();
  await expect(visualizador.getByRole('img')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(visualizador).toBeHidden();

  await page.getByTestId('galeria-item').getByRole('button', { name: /Ampliar anexo/ }).click();
  await expect(visualizador).toBeVisible();
  await page.goBack();
  await expect(visualizador).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/internacoes/${id}$`));
});

test('recepção não vê as abas do histórico', async ({ page }) => {
  const id = await criarExamesFinalizados(page);
  await page.context().clearCookies();
  await entrar(page, 'recepcao@teste.local');
  await page.goto(`/internacoes/${id}`);
  await expect(page.getByText('Conteúdo clínico disponível apenas para profissionais de saúde.')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'ECG' })).toHaveCount(0);
});
