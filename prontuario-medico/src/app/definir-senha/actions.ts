'use server'

import { redirect } from 'next/navigation'
import type { EstadoForm } from '@/lib/forms'
import { validarSenha } from '@/lib/senha'
import { mfaPendente } from '@/lib/auth'
import { sessaoPorLinkDeEmail } from '@/lib/sessao'
import { createClient } from '@/lib/supabase/server'

export async function definirSenha(_prev: EstadoForm, form: FormData): Promise<EstadoForm> {
  const senha = String(form.get('senha') ?? '')
  const confirmacao = String(form.get('confirmacao') ?? '')

  const erroSenha = validarSenha(senha)
  if (erroSenha) return { erro: erroSenha }
  if (senha !== confirmacao) return { erro: 'As senhas não conferem.' }

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) redirect('/login')
  if (!data?.claims || !sessaoPorLinkDeEmail(data.claims)) {
    return { erro: 'Use o link enviado por e-mail para definir a senha.' }
  }

  if (await mfaPendente(supabase)) redirect('/mfa/verificar?next=%2Fdefinir-senha')

  const { error } = await supabase.auth.updateUser({ password: senha })
  if (error) {
    console.error('definirSenha:', error.message)
    return { erro: 'Não foi possível salvar a senha. Tente novamente ou peça um novo link.' }
  }

  const { data: perfil } = await supabase.from('profissionais').select('perfil').eq('id', userId).maybeSingle()
  redirect(perfil?.perfil === 'admin' ? '/mfa/cadastrar' : '/')
}
