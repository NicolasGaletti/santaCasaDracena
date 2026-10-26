'use server'

import { origemDoSite } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'

export type EstadoEsqueci = { enviado?: boolean }

export async function pedirLink(_prev: EstadoEsqueci, form: FormData): Promise<EstadoEsqueci> {
  const email = String(form.get('email') ?? '').trim()

  if (email) {
    try {
      const supabase = await createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origemDoSite()}/auth/callback?next=/definir-senha`,
      })
      if (error) console.error('esqueci-senha:', error.message)
    } catch (e) {
      console.error('esqueci-senha:', e)
    }
  }

  // Resposta sempre igual: não revela se o e-mail existe nem se houve erro.
  return { enviado: true }
}
