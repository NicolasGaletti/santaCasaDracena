import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type Profissional = Database['public']['Tables']['profissionais']['Row']

export const exigirProfissional = cache(async (): Promise<Profissional> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub

  if (!userId) redirect('/login')

  const { data: profissional } = await supabase
    .from('profissionais')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (!profissional || !profissional.ativo) {
    await supabase.auth.signOut()
    redirect('/login?error=sem_cadastro')
  }

  // MFA obrigatório só para admin: sem fator verificado cadastra; com fator e sessão aal1 confirma o código.
  if (profissional.perfil === 'admin') {
    const { temFator, verificado } = await situacaoMfa(supabase, data.claims.aal)
    if (!temFator) redirect('/mfa/cadastrar')
    if (!verificado) redirect('/mfa/verificar')
  } else if (await mfaPendente(supabase)) {
    // qualquer perfil com autenticador ativo: senha sozinha (aal1) não basta
    redirect('/mfa/verificar')
  }

  return profissional
})

/**
 * Páginas /mfa/*: exigem sessão e profissional ativo, mas não aplicam a checagem de aal
 * (senão o admin ficaria preso num redirect em loop).
 */
export async function exigirSessaoMfa() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) redirect('/login')

  const { data: profissional } = await supabase
    .from('profissionais')
    .select('id, ativo')
    .eq('id', userId)
    .maybeSingle()
  if (!profissional || !profissional.ativo) {
    await supabase.auth.signOut()
    redirect('/login?error=sem_cadastro')
  }

  return situacaoMfa(supabase, data.claims.aal)
}

/** True se a conta tem fator verificado e a sessão ainda é aal1 (falta o código). Sem consulta de fatores. */
export async function mfaPendente(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  return data?.nextLevel === 'aal2' && data.currentLevel === 'aal1'
}

/** `aal` vem das claims já validadas; fator verificado vem do servidor de autenticação. */
async function situacaoMfa(supabase: SupabaseClient<Database>, aal: string | undefined) {
  const { data } = await supabase.auth.mfa.listFactors()
  return { temFator: (data?.totp.length ?? 0) > 0, fatorId: data?.totp[0]?.id, verificado: aal === 'aal2' }
}

/** Rotas clínicas: admin não lê conteúdo clínico e vai para a administração. */
export async function exigirNaoAdmin(): Promise<Profissional> {
  const profissional = await exigirProfissional()
  if (profissional.perfil === 'admin') redirect('/admin/profissionais')
  return profissional
}

/** Rotas /admin: qualquer outro perfil volta ao início. */
export async function exigirAdmin(): Promise<Profissional> {
  const profissional = await exigirProfissional()
  if (profissional.perfil !== 'admin') redirect('/')
  return profissional
}

/** Rota /auditoria: só o perfil auditoria; os demais voltam ao início. */
export async function exigirAuditoria(): Promise<Profissional> {
  const profissional = await exigirProfissional()
  if (profissional.perfil !== 'auditoria') redirect('/')
  return profissional
}
