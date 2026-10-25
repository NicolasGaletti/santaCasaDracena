import { expect, test, type Page } from '@playwright/test';

const SENHA = 'Teste@123';
const INTERNACAO_SEED_A01 = 'c0000000-0000-0000-0000-000000000001';
const URL_PRONTUARIO = /\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

/** Admite um paciente novo como medico1 e devolve o id da internação. */
async function admitirPaciente(page: Page, leito: string): Promise<string> {
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('link', { name: 'Admitir paciente' }).click();
  await page.getByLabel('Nome completo').fill(`Paciente E2E ${leito}`);
  await page.getByLabel('Data de nascimento').fill('1970-03-10');
  await page.getByLabel('Convênio').fill('SUS');
  await page.getByLabel('Equipe responsável').selectOption({ label: 'Cardiologia' });
  await page.getByLabel('Leito / ala').fill(leito);
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();
  // Primeira navegação após o boot do dev server pode compilar a rota: tempo maior.
  await expect(page).toHaveURL(URL_PRONTUARIO, { timeout: 20_000 });
  return new URL(page.url()).pathname.split('/').pop() as string;
}

async function abrirNovaEvolucao(page: Page) {
  await page.getByRole('link', { name: 'Nova evolução' }).click();
  await expect(page).toHaveURL(/\/evolucao$/);
  await expect(page.getByLabel('Evolução clínica')).toBeVisible();
}

async function finalizarEvolucao(page: Page, evolucao: string, conduta: string) {
  await page.getByLabel('Evolução clínica').fill(evolucao);
  await page.getByRole('textbox', { name: 'Conduta' }).fill(conduta);
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Depois de finalizada a evolução não pode ser alterada');
  await page.getByRole('button', { name: 'Confirmar finalização' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO);
}

test('médico escreve, recarrega e o texto continua', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  await abrirNovaEvolucao(page);

  await page.getByLabel('Evolução clínica').fill('Paciente estável, sem queixas novas');
  await expect(page.getByText(/Salvo às/)).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByLabel('Evolução clínica')).toHaveValue('Paciente estável, sem queixas novas');
});

test('botão Salvar grava na hora', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  await abrirNovaEvolucao(page);

  await page.getByLabel('Evolução clínica').fill('Texto salvo pelo botão');
  // Antes do autosave (3 s): o clique precisa gravar sozinho.
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText(/Salvo às/)).toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Nada a salvar — já está tudo salvo.')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Evolução clínica')).toHaveValue('Texto salvo pelo botão');
});

test('salvar offline mostra sem conexão', async ({ page, context }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  await abrirNovaEvolucao(page);

  await context.setOffline(true);
  await page.getByLabel('Evolução clínica').fill('Texto salvo offline pelo botão');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Sem conexão: o rascunho continua salvo neste aparelho.')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled();

  await context.setOffline(false);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText(/Salvo às/)).toBeVisible({ timeout: 10_000 });
});

test('campos ficam bloqueados até a hidratação e liberam depois', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());

  // Segura o JS do cliente: o HTML do servidor aparece, mas o React ainda não hidratou.
  let liberar: () => void = () => {};
  const segurado = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  await page.route('**/_next/static/**', async (r) => {
    await segurado;
    await r.continue();
  });

  await page.goto(`/internacoes/${id}/evolucao`, { waitUntil: 'commit' });
  const campo = page.getByLabel('Evolução clínica');
  await campo.waitFor({ state: 'attached' });
  await expect(campo).toBeDisabled();
  await expect(page.getByText('Carregando…')).toBeVisible();

  liberar();
  await expect(campo).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByText('Carregando…')).toHaveCount(0);
  await page.unroute('**/_next/static/**');

  await campo.fill('Texto depois da hidratação');
  await expect(page.getByText(/Salvo às/)).toBeVisible({ timeout: 10_000 });
});

test('leito fica bloqueado até a hidratação', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());

  let liberar: () => void = () => {};
  const segurado = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  await page.route('**/_next/static/**', async (r) => {
    await segurado;
    await r.continue();
  });

  await page.goto(`/internacoes/${id}`, { waitUntil: 'commit' });
  await page.getByLabel('Leito / ala').waitFor({ state: 'attached' });
  await expect(page.getByLabel('Leito / ala')).toBeDisabled();

  liberar();
  await expect(page.getByLabel('Leito / ala')).toBeEnabled({ timeout: 20_000 });
  await page.unroute('**/_next/static/**');
});

test('copiar anterior preenche conduta', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  await abrirNovaEvolucao(page);
  await finalizarEvolucao(page, 'Evolução de referência', 'Conduta original E2E');

  await page.getByRole('link', { name: 'Nova evolução' }).click();
  await page.getByRole('button', { name: 'Copiar anterior' }).click();
  await expect(page.getByRole('textbox', { name: 'Conduta' })).toHaveValue('Conduta original E2E');
});

test('finalizar trava: sem botão de editar e badge Finalizada', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  await abrirNovaEvolucao(page);
  await finalizarEvolucao(page, 'Evolução final E2E', 'Conduta final E2E');

  await expect(page.getByText('Finalizada', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /editar/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /editar/i })).toHaveCount(0);
});

test('médico sem CRM vê "Complete seu registro profissional"', async ({ page }) => {
  // Internação do seed: leitura apenas, nenhum dado é alterado.
  await entrar(page, 'medico.semcrm@teste.local');
  await page.goto(`/internacoes/${INTERNACAO_SEED_A01}`);
  await expect(page.getByText('Complete seu registro profissional')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nova evolução' })).toHaveCount(0);
});

test('leito muda só ao sair do campo', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);

  // Server Actions são POST na própria URL com o header `next-action`.
  const chamadas: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.headers()['next-action']) chamadas.push(req.url());
  });

  const campo = page.getByLabel('Leito / ala');
  await campo.fill('E2E-NOVO');
  await page.waitForTimeout(500);
  expect(chamadas).toHaveLength(0);

  // Espera a resposta, não só o envio: recarregar com a ação em voo pode perder a gravação.
  const gravado = page.waitForResponse((r) => r.request().method() === 'POST' && !!r.request().headers()['next-action']);
  await campo.press('Tab');
  await gravado;
  await expect.poll(() => chamadas.length).toBe(1);

  await page.reload();
  await expect(page.getByLabel('Leito / ala')).toHaveValue('E2E-NOVO');
});

test('offline: mostra "Sem conexão", volta online e salva', async ({ page, context }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  await abrirNovaEvolucao(page);

  await context.setOffline(true);
  await page.getByLabel('Evolução clínica').fill('Texto digitado sem conexão');
  await expect(page.getByText(/Sem conexão/)).toBeVisible({ timeout: 10_000 });

  await context.setOffline(false);
  await expect(page.getByText(/Salvo às/)).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByLabel('Evolução clínica')).toHaveValue('Texto digitado sem conexão');
});

test('texto digitado sem conexão sobrevive a recarga e é salvo ao voltar', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  await abrirNovaEvolucao(page);

  // Só o RPC de salvamento falha; a página continua carregando.
  await page.route('**/rest/v1/rpc/salvar_rascunho', (r) => r.abort());
  await page.getByLabel('Evolução clínica').fill('Texto antes da recarga');
  await expect(page.getByText('Sem conexão')).toBeVisible({ timeout: 10_000 });

  await page.reload();
  // Sem envio possível, o texto só pode vir do IndexedDB.
  await expect(page.getByLabel('Evolução clínica')).toHaveValue('Texto antes da recarga');
  await expect(page.getByText('Sem conexão')).toBeVisible({ timeout: 10_000 });

  await page.unroute('**/rest/v1/rpc/salvar_rascunho');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText(/Salvo às/)).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByLabel('Evolução clínica')).toHaveValue('Texto antes da recarga');
});

test('duplo clique em Confirmar finalização finaliza uma vez', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  await abrirNovaEvolucao(page);

  await page.getByLabel('Evolução clínica').fill('Evolução para duplo clique');
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta para duplo clique');
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalização' }).dblclick();

  await expect(page).toHaveURL(URL_PRONTUARIO);
  await expect(page.getByTestId('cartao-evolucao')).toHaveCount(1);
  await expect(alertas(page)).toHaveCount(0);
});

test('sinal vital inválido mostra erro e bloqueia finalizar', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  await abrirNovaEvolucao(page);

  await page.getByLabel('Evolução clínica').fill('Evolução com sinal inválido');
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta com sinal inválido');
  await page.getByRole('button', { name: 'Sinais vitais' }).click();
  await page.getByLabel('FC (bpm)').fill('abc');
  await expect(page.getByText('Digite um número.')).toBeVisible();

  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await expect(alertas(page)).toContainText('FC (bpm)');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('troca de leito em envio: mostra "Salvando leito…" e grava antes do reload', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);

  // Segura só a Server Action do leito até o teste liberar.
  let liberar: () => void = () => {};
  const segurado = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  await page.route(`**/internacoes/${id}`, async (r) => {
    if (r.request().method() === 'POST' && r.request().headers()['next-action']) await segurado;
    await r.continue();
  });

  await page.getByLabel('Leito / ala').fill('E2E-ENVIO');
  await page.getByLabel('Leito / ala').press('Tab');
  await expect(page.getByText('Salvando leito…')).toBeVisible();

  liberar();
  await expect(page.getByText('Salvando leito…')).toHaveCount(0, { timeout: 10_000 });
  await page.unroute(`**/internacoes/${id}`);

  await page.reload();
  await expect(page.getByLabel('Leito / ala')).toHaveValue('E2E-ENVIO');
});

test('leito vazio mostra "Informe o leito." e restaura o valor', async ({ page }) => {
  const leito = leitoUnico();
  const id = await admitirPaciente(page, leito);
  await page.goto(`/internacoes/${id}`);

  const campo = page.getByLabel('Leito / ala');
  await campo.fill('   ');
  await campo.press('Tab');
  await expect(alertas(page)).toHaveText('Informe o leito.');
  await expect(campo).toHaveValue(leito);
});

test('finalizar com a ação de servidor interrompida: aviso, botão volta a funcionar', async ({ page }) => {
  const id = await admitirPaciente(page, leitoUnico());
  await page.goto(`/internacoes/${id}`);
  await abrirNovaEvolucao(page);
  await page.getByLabel('Evolução clínica').fill('Evolução para falha de rede');
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Conduta para falha de rede');

  // Só a primeira ação de servidor (a finalização) falha; as seguintes passam.
  let abortada = false;
  await page.route('**/internacoes/**/evolucao', (r) => {
    if (r.request().method() === 'POST' && r.request().headers()['next-action'] && !abortada) {
      abortada = true;
      return r.abort();
    }
    return r.continue();
  });
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalização' }).click();
  await expect(alertas(page)).toContainText('Sem conexão: a evolução não foi finalizada');

  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalização' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO);
  expect(abortada).toBe(true);
});

test('residente vê o aviso no lugar de Finalizar e não vê o botão de outra equipe', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill('residente@teste.local');
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();

  // Internação da Cardiologia (seed): a residente não é membro da equipe.
  await page.goto(`/internacoes/${INTERNACAO_SEED_A01}`);
  await expect(page.getByRole('link', { name: 'Nova evolução' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Continuar rascunho' })).toHaveCount(0);
});

test('residente da equipe evolui sem botão Finalizar', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill('residente@teste.local');
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();

  // Internação da Clínica Médica (seed): a residente é membro da equipe.
  await page.goto('/internacoes/c0000000-0000-0000-0000-000000000003');
  await page.getByRole('link', { name: /Nova evolução|Continuar rascunho/ }).click();
  await expect(page).toHaveURL(/\/evolucao$/);
  await expect(page.getByRole('button', { name: 'Enviar para validação', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalizar', exact: true })).toHaveCount(0);
});

test('recepção vê o prontuário sem conteúdo clínico', async ({ page }) => {
  await entrar(page, 'recepcao@teste.local');
  await page.goto(`/internacoes/${INTERNACAO_SEED_A01}`);
  await expect(page.getByText('Conteúdo clínico disponível apenas para profissionais de saúde.')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Evoluções' })).toHaveCount(0);
});

test('enfermeira abre formulário simples', async ({ page }) => {
  await entrar(page, 'enfermeira@teste.local');
  await page.goto(`/internacoes/${INTERNACAO_SEED_A01}`);
  await page.getByRole('link', { name: 'Nova evolução' }).click();
  await expect(page).toHaveURL(/\/evolucao$/);
  await expect(page.getByRole('heading', { name: 'Evolução de Enfermagem' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Evolução', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Plano', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar para validação' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Finalizar', exact: true })).toHaveCount(0);
});

test('enfermeira salva o formulário simples e recarrega', async ({ page }) => {
  await entrar(page, 'enfermeira@teste.local');
  await page.goto(`/internacoes/${INTERNACAO_SEED_A01}`);
  await page.getByRole('link', { name: /Nova evolução|Continuar rascunho/ }).click();
  await expect(page.getByRole('textbox', { name: 'Evolução', exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('textbox', { name: 'Evolução', exact: true }).fill('Curativo limpo, sem sinais flogísticos');
  await page.getByRole('textbox', { name: 'Plano', exact: true }).fill('Trocar curativo em 48 h');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText(/Salvo às/)).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Evolução', exact: true })).toHaveValue('Curativo limpo, sem sinais flogísticos');
  await expect(page.getByRole('textbox', { name: 'Plano', exact: true })).toHaveValue('Trocar curativo em 48 h');
  await page.getByRole('button', { name: 'Descartar rascunho' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar rascunho' }).click();
  await expect(page).toHaveURL(URL_PRONTUARIO);
});

test('acadêmico abre o formulário médico sem CRM e não finaliza', async ({ page }) => {
  await entrar(page, 'academico@teste.local');
  await page.goto(`/internacoes/${INTERNACAO_SEED_A01}`);
  await page.getByRole('link', { name: 'Nova evolução' }).click();
  await expect(page.getByLabel('Evolução clínica')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalizar', exact: true })).toHaveCount(0);
});
