import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sessaoPorLinkDeEmail } from '@/lib/sessao'
import { FormSenha } from './form'

export default async function DefinirSenhaPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect('/login')

  if (!sessaoPorLinkDeEmail(data.claims)) redirect('/')

  return <FormSenha />
}
