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
