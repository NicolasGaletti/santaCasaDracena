import { expect, test, type Page } from '@playwright/test';
import { clienteAdmin, convenioOrdenados, salvarConvenio } from './helpers/convenios';

const SENHA = 'Teste@123';
const EQUIPE_NEFROLOGIA = 'e0000000-0000-0000-0000-000000000003';
const EQUIPE_CARDIOLOGIA = 'e0000000-0000-0000-0000-000000000001';

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail Profissional').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible();
}

function nomeUnico(): string {
  return `Paciente E2E ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test('medico1 admite paciente e cai no prontuário', async ({ page }) => {
  const nome = nomeUnico();
  await entrar(page, 'medico1@teste.local');

  await page.getByRole('link', { name: 'Admitir paciente' }).click();
  await expect(page).toHaveURL(/\/internacoes\/nova$/);

  await page.getByLabel('Nome completo').fill(nome);
  await page.getByLabel('Data de nascimento').fill('1970-03-10');
  await page.getByLabel('Convênio').selectOption({ label: 'SUS' });
  await page.getByRole('radio', { name: 'Cardiologia' }).click();
  await page.getByLabel('Leito / ala').fill('E2E-01');
  await page.getByLabel('Diagnóstico inicial').fill('Dor torácica');
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();

  await expect(page).toHaveURL(/\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  await expect(page.locator('[data-slot="cabecalho-paciente"]')).toContainText('Cardiologia');
  await expect(page.getByText('Médico responsável')).toHaveCount(0);
});

test('admissão não pede médico responsável', async ({ page }) => {
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('link', { name: 'Admitir paciente' }).click();
  await expect(page).toHaveURL(/\/internacoes\/nova$/);

  await expect(page.getByLabel('Equipe responsável')).toBeVisible();
  await expect(page.getByLabel('Médico responsável')).toHaveCount(0);
});

test('seed antigo com médico vinculado abre sem exibir médico responsável', async ({ page }) => {
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('heading', { name: 'Paciente Fictício 01' }).click();
  await expect(page).toHaveURL(/\/internacoes\/c0000000-0000-0000-0000-000000000001$/);
  await expect(page.getByRole('heading', { name: 'Paciente Fictício 01' })).toBeVisible();
  await expect(page.locator('[data-slot="cabecalho-paciente"] [data-slot="leito-texto"]')).toBeVisible();
  await expect(page.getByText('Médico responsável')).toHaveCount(0);
});

test('filtro por convênio com acento mostra só o convênio escolhido', async ({ page }) => {
  await entrar(page, 'medico1@teste.local');
  await page
    .getByRole('navigation', { name: 'Filtrar por convênio' })
    .getByRole('link', { name: 'Bradesco Saúde', exact: true })
    .click();
  await expect(page).toHaveURL(/convenio=Bradesco\+Sa%C3%BAde$/);

  const cartoes = page.getByTestId('cartao-internacao');
  await expect(cartoes.filter({ hasText: 'Paciente Fictício 04' })).toHaveCount(1);
  await expect(page.getByText('Paciente Fictício 01')).toHaveCount(0);
  await expect(page.getByText('Paciente Fictício 02')).toHaveCount(0);
});

test('equipe e convênio combinados filtram pelos dois', async ({ page }) => {
  await entrar(page, 'medico1@teste.local');
  await page
    .getByRole('navigation', { name: 'Filtrar por equipe' })
    .getByRole('link', { name: 'Cardiologia', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`equipe=${EQUIPE_CARDIOLOGIA}$`));
  await page
    .getByRole('navigation', { name: 'Filtrar por convênio' })
    .getByRole('link', { name: 'SUS', exact: true })
    .click();

  await expect(page).toHaveURL(new RegExp(`equipe=${EQUIPE_CARDIOLOGIA}&convenio=SUS$`));
  await expect(page.getByRole('navigation', { name: 'Filtrar por equipe' }).getByRole('link', { name: 'Cardiologia', exact: true })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('navigation', { name: 'Filtrar por convênio' }).getByRole('link', { name: 'SUS', exact: true })).toHaveAttribute('aria-current', 'true');
  // Paciente 01 é SUS e Cardiologia; 02 é Unimed e 05 é SUS mas Nefrologia.
  await expect(page.getByText('Paciente Fictício 01')).toHaveCount(1);
  await expect(page.getByText('Paciente Fictício 02')).toHaveCount(0);
  await expect(page.getByText('Paciente Fictício 05')).toHaveCount(0);
});

test('admissão sem leito mostra erro e mantém campos', async ({ page }) => {
  const nome = nomeUnico();
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('link', { name: 'Admitir paciente' }).click();

  await page.getByLabel('Nome completo').fill(nome);
  await page.getByLabel('Data de nascimento').fill('1970-03-10');
  await page.getByLabel('Convênio').selectOption({ label: 'Unimed' });
  await page.getByRole('radio', { name: 'Cardiologia' }).click();
  // Espaços passam na validação nativa de "required" mas o servidor recusa após trim.
  await page.getByLabel('Leito / ala').fill('   ');
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();

  await expect(page.locator('p[role="alert"]')).toHaveText('Preencha os campos obrigatórios.');
  await expect(page).toHaveURL(/\/internacoes\/nova$/);
  await expect(page.getByLabel('Nome completo')).toHaveValue(nome);
  await expect(page.getByLabel('Convênio')).toHaveValue('Unimed');
  await expect(page.getByLabel('Data de nascimento')).toHaveValue('1970-03-10');
});

test('filtro Nefrologia esconde pacientes da Cardiologia', async ({ page }) => {
  await entrar(page, 'medico1@teste.local');
  await expect(page.getByText('Paciente Fictício 01')).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Filtrar por equipe' })
    .getByRole('link', { name: 'Nefrologia', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`equipe=${EQUIPE_NEFROLOGIA}`));

  await expect(page.getByText('Paciente Fictício 05')).toBeVisible();
  await expect(page.getByText('Paciente Fictício 01')).toHaveCount(0);
});

test('anteriores mostra só ALTA, sem ações de admissão ou evolução', async ({ page }) => {
  await entrar(page, 'medico1@teste.local');
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: /anteriores/i })
    .click();
  await expect(page).toHaveURL(/\/anteriores$/);

  // Seed: internações ALTA 07 e 08; nenhuma INTERNADO (01-06). Outros testes também encerram internações,
  // então não se fixa a contagem total.
  const cartoes = page.getByTestId('cartao-internacao');
  await expect(cartoes.first()).toBeVisible();
  await expect(cartoes.filter({ hasText: 'Paciente Fictício 07' })).toHaveCount(1);
  await expect(cartoes.filter({ hasText: 'Paciente Fictício 08' })).toHaveCount(1);
  for (const n of ['01', '02', '03', '04', '05', '06']) {
    await expect(page.getByText(`Paciente Fictício ${n}`)).toHaveCount(0);
  }

  await expect(page.getByText('Sem evolução')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Admitir paciente' })).toHaveCount(0);
});

async function abrirAdmissao(page: Page) {
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('link', { name: 'Admitir paciente' }).click();
  await expect(page).toHaveURL(/\/internacoes\/nova$/);
}

test('admissão oferece só convênios ativos da lista, mais usados primeiro', async ({ page }) => {
  const admin = await clienteAdmin();
  const nome = `Convênio Inativo ${Math.random().toString(36).slice(2, 7)}`;
  const id = await salvarConvenio(admin, null, nome, true);
  await salvarConvenio(admin, id, nome, false);

  await abrirAdmissao(page);
  const opcoes = (await page.getByLabel('Convênio').locator('option').allTextContents()).filter((t) => t !== 'Escolha o convênio');
  expect(opcoes).not.toContain(nome);
  expect(opcoes).toEqual(await convenioOrdenados());
  for (const esperado of ['SUS', 'Particular', 'Unimed', 'Bradesco Saúde']) expect(opcoes).toContain(esperado);
  // Texto livre deixou de existir: o campo é uma lista.
  expect(await page.getByLabel('Convênio').evaluate((el) => el.tagName)).toBe('SELECT');
});

test('idade aparece ao preencher a data, sem texto de aviso', async ({ page }) => {
  await abrirAdmissao(page);
  await expect(page.getByText('Idade será calculada')).toHaveCount(0);
  await expect(page.getByTestId('idade')).toHaveCount(0);

  const convenio = page.getByLabel('Convênio');
  const antes = await convenio.boundingBox();
  const ano = new Date().getFullYear() - 40;
  await page.getByLabel('Data de nascimento').fill(`${ano}-01-01`);
  await expect(page.getByTestId('idade')).toHaveText('40 anos');
  const depois = await convenio.boundingBox();
  expect(depois?.y).toBe(antes?.y);
  expect(depois?.height).toBe(antes?.height);

  await page.getByLabel('Data de nascimento').fill('');
  await expect(page.getByTestId('idade')).toHaveCount(0);
});

test('convênio desativado depois de abrir a tela → "Escolha um convênio da lista." e dados mantidos', async ({ page }) => {
  const admin = await clienteAdmin();
  const convenio = `Convênio Efêmero ${Math.random().toString(36).slice(2, 7)}`;
  const id = await salvarConvenio(admin, null, convenio, true);
  const nome = nomeUnico();

  await abrirAdmissao(page);
  await page.getByLabel('Nome completo').fill(nome);
  await page.getByLabel('Data de nascimento').fill('1970-03-10');
  await page.getByLabel('Convênio').selectOption({ label: convenio });
  await page.getByRole('radio', { name: 'Cardiologia' }).click();
  await page.getByLabel('Leito / ala').fill('E2E-CONV');
  await page.getByLabel('Diagnóstico inicial').fill('Dor torácica');

  await salvarConvenio(admin, id, convenio, false);
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();

  await expect(page.locator('#convenio-erro')).toHaveText('Escolha um convênio da lista.');
  await expect(page).toHaveURL(/\/internacoes\/nova$/);
  await expect(page.getByLabel('Nome completo')).toHaveValue(nome);
  await expect(page.getByLabel('Data de nascimento')).toHaveValue('1970-03-10');
  await expect(page.getByLabel('Leito / ala')).toHaveValue('E2E-CONV');
  await expect(page.getByLabel('Diagnóstico inicial')).toHaveValue('Dor torácica');
  await expect(page.getByRole('radio', { name: 'Cardiologia' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Convênio').locator('option', { hasText: convenio })).toHaveCount(0);
});

test('chips de equipe por teclado', async ({ page }) => {
  await abrirAdmissao(page);
  const grupo = page.getByRole('radiogroup', { name: 'Equipe responsável' });
  const chips = grupo.getByRole('radio');
  await expect(chips.first()).toBeVisible();
  await expect(grupo.locator('[aria-checked="true"]')).toHaveCount(0);

  await chips.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(chips.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(chips.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(chips.first()).toHaveAttribute('aria-checked', 'true');
  await expect(grupo.locator('[aria-checked="true"]')).toHaveCount(1);
});

test('primeira evolução médica já traz o quadro de admissão; a seguinte vem vazia', async ({ page }) => {
  const nome = nomeUnico();
  await entrar(page, 'medico1@teste.local');
  await page.getByRole('link', { name: 'Admitir paciente' }).click();
  await page.getByLabel('Nome completo').fill(nome);
  await page.getByLabel('Data de nascimento').fill('1970-03-10');
  await page.getByLabel('Convênio').selectOption({ label: 'SUS' });
  await page.getByRole('radio', { name: 'Cardiologia' }).click();
  await page.getByLabel('Leito / ala').fill('E2E-02');
  await page.getByLabel('Diagnóstico inicial').fill('IAMSSST');
  await page.getByLabel('Comorbidades').fill('HAS, DM2');
  await page.getByLabel('MUC (medicamentos de uso contínuo)').fill('AAS 100mg');
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();
  await expect(page).toHaveURL(/\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, { timeout: 20_000 });

  const ficha = page.locator('#ficha');
  await expect(ficha.getByLabel('Diagnósticos')).toHaveValue('IAMSSST');
  await expect(ficha.getByLabel('Comorbidades')).toHaveValue('HAS, DM2');
  await expect(ficha.getByLabel('MUC')).toHaveValue('AAS 100mg');

  await page.getByLabel('Evolução clínica').fill('Estável');
  await page.getByRole('textbox', { name: 'Conduta' }).fill('Manter');
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar finalização' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await expect(ficha.getByLabel('Diagnósticos')).toHaveValue('');
  await expect(ficha.getByLabel('Comorbidades')).toHaveValue('');
  await expect(ficha.getByLabel('MUC')).toHaveValue('');
  await page.getByRole('button', { name: 'Copiar evolução anterior' }).click();
  await expect(ficha.getByLabel('Diagnósticos')).toHaveValue('IAMSSST');
});
