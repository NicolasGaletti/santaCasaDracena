import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FormSenha } from './form'

export default async function DefinirSenhaPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect('/login')

  return <FormSenha />
}
