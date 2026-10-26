import { cache } from 'react'
import { redirect } from 'next/navigation'
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

  return profissional
})

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
