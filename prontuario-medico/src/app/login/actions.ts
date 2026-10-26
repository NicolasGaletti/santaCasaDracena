'use server'

import { redirect } from 'next/navigation'
import type { EstadoForm } from '@/lib/forms'
import { destinoSeguro } from '@/lib/redirect'
import { createClient } from '@/lib/supabase/server'

type EstadoLogin = EstadoForm & { email?: string }

export async function entrar(_prev: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const email = String(form.get('email') ?? '')
  const senha = String(form.get('senha') ?? '')
  const next = String(form.get('next') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

  if (error) return { erro: 'E-mail ou senha inválidos.', email }

  redirect(destinoSeguro(next))
}

/** `pendente`: um rascunho não sincronizado ficou guardado no aparelho (a tela de login avisa). */
export async function sair(pendente = false): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(pendente ? '/login?pendente=1' : '/login')
}

export async function sairPorInatividade(pendente = false): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(pendente ? '/login?motivo=inatividade&pendente=1' : '/login?motivo=inatividade')
}
