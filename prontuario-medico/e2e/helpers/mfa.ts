import { expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { generate } from 'otplib'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_CHAVE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const SENHA = 'Teste@123'

/** Secret do fator TOTP semeado para admin@teste.local (supabase/seed.sql). */
export const SEGREDO_ADMIN_SEED = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
export const ADMIN_COM_FATOR = 'admin@teste.local'
export const ADMIN_SEM_FATOR = 'admin.semmfa@teste.local'

export function codigoTotp(segredo: string): Promise<string> {
  return generate({ secret: segredo })
}

/** Remove os fatores TOTP do usuário (banco local). */
export function removerFatores(email: string): void {
  execFileSync(
    'docker',
    ['exec', 'supabase_db_prontuario-medico', 'psql', '-U', 'postgres', '-c',
      `delete from auth.mfa_factors where user_id = (select id from auth.users where email = '${email}')`],
    { encoding: 'utf8' },
  )
}

/** Login por senha na tela. Não conclui o MFA. */
export async function entrarComSenha(page: Page, email: string, senha = SENHA): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-mail Profissional').fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click()
}

/** Login do admin semeado: senha + código do autenticador. Termina em /admin/profissionais. */
export async function entrarAdmin(page: Page, email = ADMIN_COM_FATOR, segredo = SEGREDO_ADMIN_SEED): Promise<void> {
  await entrarComSenha(page, email)
  await expect(page).toHaveURL(/\/mfa\/verificar/)
  await page.getByLabel('Código de 6 dígitos').fill(await codigoTotp(segredo))
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page).toHaveURL(/\/admin\/profissionais$/)
}

/** Token de acesso aal2 do admin semeado (para chamar a Edge Function / RPC direto). */
export async function tokenAdminAal2(email = ADMIN_COM_FATOR, segredo = SEGREDO_ADMIN_SEED): Promise<string> {
  const cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } })
  const { error } = await cliente.auth.signInWithPassword({ email, password: SENHA })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  const { data: fatores } = await cliente.auth.mfa.listFactors()
  const fator = fatores?.totp[0]
  if (!fator) throw new Error(`${email} sem fator TOTP`)
  const { error: erroMfa } = await cliente.auth.mfa.challengeAndVerify({
    factorId: fator.id,
    code: await codigoTotp(segredo),
  })
  if (erroMfa) throw new Error(`mfa ${email}: ${erroMfa.message}`)
  const { data } = await cliente.auth.getSession()
  if (!data.session) throw new Error('sem sessão aal2')
  return data.session.access_token
}
