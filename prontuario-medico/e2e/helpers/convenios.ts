import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { tokenAdminAal2 } from './mfa'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_CHAVE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

/** Cliente do banco local autenticado com o token informado (admin aal2). */
export async function clienteAdmin(): Promise<SupabaseClient> {
  const token = await tokenAdminAal2()
  return createClient(SUPABASE_URL, SUPABASE_CHAVE, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

export async function salvarConvenio(
  cliente: SupabaseClient,
  id: string | null,
  nome: string,
  ativo: boolean | null,
): Promise<string> {
  const { data, error } = await cliente.rpc('admin_salvar_convenio', { p_id: id, p_nome: nome, p_ativo: ativo })
  if (error) throw new Error(error.message)
  return data as string
}

/** Convênios ativos na ordem da view, lidos como médico (RLS aplica a contagem de usos). */
export async function convenioOrdenados(): Promise<string[]> {
  const cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } })
  const { error: e } = await cliente.auth.signInWithPassword({ email: 'medico1@teste.local', password: 'Teste@123' })
  if (e) throw new Error(e.message)
  const { data, error } = await cliente.from('vw_convenios_ordenados').select('nome')
  if (error) throw new Error(error.message)
  return (data ?? []).map((l) => l.nome as string)
}
