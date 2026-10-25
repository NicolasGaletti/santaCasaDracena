'use server'

import { exigirProfissional } from '@/lib/auth'
import { removerObjetosAnexo } from './remover-objetos'
import { createClient } from '@/lib/supabase/server'

const MENSAGEM_GENERICA = 'Não foi possível remover o anexo. Tente novamente.'

/** Apaga o objeto no Storage primeiro; só então apaga a linha. Se o objeto falhar, a linha fica. */
export async function removerAnexo(anexoId: string): Promise<{ erro?: string }> {
  await exigirProfissional()
  const supabase = await createClient()

  const { data: anexo, error: erroBusca } = await supabase
    .from('anexos')
    .select('storage_path')
    .eq('id', anexoId)
    .maybeSingle()
  if (erroBusca) return { erro: MENSAGEM_GENERICA }
  if (!anexo) return { erro: 'Anexo não encontrado.' }

  if (!(await removerObjetosAnexo(supabase, [anexo.storage_path]))) return { erro: MENSAGEM_GENERICA }

  const { error } = await supabase.rpc('remover_anexo', { p_anexo_id: anexoId })
  if (error) return { erro: error.code === 'P0001' ? error.message : MENSAGEM_GENERICA }

  return {}
}

/** Validade da URL assinada da prévia, em segundos. */
const VALIDADE_URL_SEGUNDOS = 300;

/**
 * URL assinada de 300 s para ver um anexo. Confere a linha com o cliente do usuário (RLS): anexo
 * invisível (recepção, outro autor, rascunho alheio) não recebe URL.
 */
export async function urlAssinada(anexoId: string): Promise<{ url?: string; erro?: string }> {
  await exigirProfissional()
  const supabase = await createClient()

  const { data: anexo, error: erroBusca } = await supabase
    .from('anexos')
    .select('storage_path')
    .eq('id', anexoId)
    .maybeSingle()
  if (erroBusca) return { erro: 'Não foi possível abrir o anexo. Tente novamente.' }
  if (!anexo) return { erro: 'Anexo não encontrado.' }

  const { data, error } = await supabase.storage
    .from('anexos')
    .createSignedUrl(anexo.storage_path, VALIDADE_URL_SEGUNDOS)
  if (error || !data?.signedUrl) return { erro: 'Não foi possível abrir o anexo. Tente novamente.' }

  return { url: data.signedUrl }
}
