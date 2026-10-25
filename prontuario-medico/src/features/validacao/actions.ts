'use server'

import { revalidatePath } from 'next/cache'
import { exigirProfissional } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const MENSAGEM_GENERICA = 'Não foi possível concluir a operação. Tente novamente.'

// Só mensagens P0001 são pt-BR escritas para o usuário; o resto é erro técnico.
function mensagemDeErro(error: { code?: string; message: string }): string {
  return error.code === 'P0001' ? error.message : MENSAGEM_GENERICA
}

/** Atualiza a lista de pendentes, o contador da aba e a prontuário da internação. */
async function revalidarValidacao(internacaoId: string | null | undefined) {
  revalidatePath('/validacao')
  revalidatePath('/', 'layout')
  if (internacaoId) revalidatePath(`/internacoes/${internacaoId}`)
}

async function buscarInternacao(evolucaoId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('evolucoes').select('internacao_id').eq('id', evolucaoId).maybeSingle()
  return data?.internacao_id ?? null
}

/** Validação pelo médico da equipe (não autor): a evolução fica finalizada. */
export async function validar(evolucaoId: string): Promise<{ erro?: string }> {
  await exigirProfissional()
  try {
    const supabase = await createClient()
    const internacaoId = await buscarInternacao(evolucaoId)
    const { error } = await supabase.rpc('validar_evolucao', { p_evolucao_id: evolucaoId })
    if (error) return { erro: mensagemDeErro(error) }

    await revalidarValidacao(internacaoId)
    return {}
  } catch {
    return { erro: MENSAGEM_GENERICA }
  }
}

/** Devolução ao autor com motivo obrigatório (1–500): a evolução volta a rascunho. */
export async function devolver(evolucaoId: string, motivo: string): Promise<{ erro?: string }> {
  await exigirProfissional()
  try {
    const supabase = await createClient()
    const internacaoId = await buscarInternacao(evolucaoId)
    const { error } = await supabase.rpc('devolver_evolucao', { p_evolucao_id: evolucaoId, p_motivo: motivo })
    if (error) return { erro: mensagemDeErro(error) }

    await revalidarValidacao(internacaoId)
    return {}
  } catch {
    return { erro: MENSAGEM_GENERICA }
  }
}
