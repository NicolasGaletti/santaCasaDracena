import { redirect } from 'next/navigation'
import { mfaPendente } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { sessaoPorLinkDeEmail } from '@/lib/sessao'
import { FormSenha } from './form'

export default async function DefinirSenhaPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect('/login')

  if (!sessaoPorLinkDeEmail(data.claims)) redirect('/')

  // o GoTrue recusa trocar a senha em sessão aal1 quando há autenticador: pede o código antes
  if (await mfaPendente(supabase)) redirect('/mfa/verificar?next=%2Fdefinir-senha')

  return <FormSenha />
}
