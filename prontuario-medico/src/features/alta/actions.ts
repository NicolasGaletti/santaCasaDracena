'use server'

import { revalidatePath } from 'next/cache'
import { exigirProfissional } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ehTipoAlta } from './tipos'

const MENSAGEM_GENERICA = 'Não foi possível dar a alta. Tente novamente.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Alta médica. `altaEm` nulo = agora (o banco usa now()). Mensagens P0001 do banco são pt-BR e
 * seguem para a tela; qualquer outro erro vira a mensagem genérica.
 */
export async function darAlta(
  internacaoId: string,
  dados: { tipo: string; resumo: string; altaEm: string | null },
): Promise<{ erro?: string }> {
  await exigirProfissional()
  if (!UUID.test(internacaoId)) return { erro: MENSAGEM_GENERICA }
  if (!ehTipoAlta(dados.tipo)) return { erro: 'Informe o tipo da alta.' }
  if (dados.altaEm !== null && Number.isNaN(new Date(dados.altaEm).getTime())) {
    return { erro: 'Informe uma data e hora válidas.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('dar_alta', {
    p_internacao_id: internacaoId,
    p_tipo: dados.tipo,
    p_resumo: dados.resumo,
    ...(dados.altaEm ? { p_alta_em: dados.altaEm } : {}),
  })
  if (error) return { erro: error.code === 'P0001' ? error.message : MENSAGEM_GENERICA }

  revalidatePath('/', 'layout')
  return {}
}
