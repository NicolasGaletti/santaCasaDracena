import { expect, test, type Page } from '@playwright/test';

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
  await page.getByLabel('Convênio').fill('SUS');
  await page.getByLabel('Equipe responsável').selectOption({ label: 'Cardiologia' });
  await page.getByLabel('Leito / ala').fill('E2E-01');
  await page.getByLabel('Diagnóstico inicial').fill('Dor torácica');
  await page.getByRole('button', { name: 'Confirmar admissão' }).click();

  await expect(page).toHaveURL(/\/internacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  await expect(page.getByText('Equipe responsável', { exact: true })).toBeVisible();
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
  await expect(page.getByText('Equipe responsável', { exact: true })).toBeVisible();
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
  await page.getByLabel('Convênio').fill('Unimed');
  await page.getByLabel('Equipe responsável').selectOption({ label: 'Cardiologia' });
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
