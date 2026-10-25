import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type Profissional = Database['public']['Tables']['profissionais']['Row']

export async function exigirProfissional(): Promise<Profissional> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub

  if (!userId) redirect('/login')

  const { data: profissional } = await supabase
    .from('profissionais')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (!profissional || !profissional.ativo) redirect('/login?error=sem_cadastro')

  return profissional
}
