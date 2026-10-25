'use server'

import { redirect } from 'next/navigation'
import type { EstadoForm } from '@/lib/forms'
import { createClient } from '@/lib/supabase/server'

function destinoSeguro(next: string) {
  const mesmaOrigem = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
  return mesmaOrigem ? next : '/'
}

export async function entrar(_prev: EstadoForm, form: FormData): Promise<EstadoForm> {
  const email = String(form.get('email') ?? '')
  const senha = String(form.get('senha') ?? '')
  const next = String(form.get('next') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

  if (error) return { erro: 'E-mail ou senha inválidos.' }

  redirect(destinoSeguro(next))
}

export async function sair(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
