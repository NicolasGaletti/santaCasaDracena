'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { exigirProfissional } from '@/lib/auth'
import { removerObjetosAnexo } from '@/features/anexos/remover-objetos'
import { createClient } from '@/lib/supabase/server'

const MENSAGEM_GENERICA = 'Não foi possível concluir a operação. Tente novamente.'

// Só mensagens P0001 são pt-BR escritas para o usuário; o resto é erro técnico.
function mensagemDeErro(error: { code?: string; message: string }): string {
  return error.code === 'P0001' ? error.message : MENSAGEM_GENERICA
}

export async function finalizar(evolucaoId: string): Promise<{ erro?: string }> {
  await exigirProfissional()
  const supabase = await createClient()

  const { data: evolucao, error: erroBusca } = await supabase
    .from('evolucoes')
    .select('internacao_id')
    .eq('id', evolucaoId)
    .maybeSingle()
  if (erroBusca || !evolucao) return { erro: MENSAGEM_GENERICA }

  const { error } = await supabase.rpc('finalizar_evolucao', { p_evolucao_id: evolucaoId })
  if (error) return { erro: mensagemDeErro(error) }

  revalidatePath(`/internacoes/${evolucao.internacao_id}`)
  redirect(`/internacoes/${evolucao.internacao_id}`)
}

/** Envio do autor (residente, acadêmico, multiprofissional) para validação do médico da equipe. */
export async function enviarParaValidacao(evolucaoId: string): Promise<{ erro?: string }> {
  await exigirProfissional()
  const supabase = await createClient()

  const { data: evolucao, error: erroBusca } = await supabase
    .from('evolucoes')
    .select('internacao_id')
    .eq('id', evolucaoId)
    .maybeSingle()
  if (erroBusca || !evolucao) return { erro: MENSAGEM_GENERICA }

  const { error } = await supabase.rpc('enviar_evolucao', { p_evolucao_id: evolucaoId })
  if (error) return { erro: mensagemDeErro(error) }

  revalidatePath(`/internacoes/${evolucao.internacao_id}`)
  redirect(`/internacoes/${evolucao.internacao_id}`)
}

/** Adendo de evolução finalizada: abre rascunho ligado à original e leva ao formulário. */
export async function criarAdendo(evolucaoId: string): Promise<{ erro?: string }> {
  await exigirProfissional()
  const supabase = await createClient()

  const { data: evolucao, error: erroBusca } = await supabase
    .from('evolucoes')
    .select('internacao_id')
    .eq('id', evolucaoId)
    .maybeSingle()
  if (erroBusca || !evolucao) return { erro: MENSAGEM_GENERICA }

  const { error } = await supabase.rpc('criar_adendo', { p_evolucao_id: evolucaoId })
  if (error) return { erro: mensagemDeErro(error) }

  revalidatePath(`/internacoes/${evolucao.internacao_id}`)
  redirect(`/internacoes/${evolucao.internacao_id}#ficha`)
}

export async function descartar(evolucaoId: string): Promise<void> {
  await exigirProfissional()
  const supabase = await createClient()

  const { data: evolucao } = await supabase
    .from('evolucoes')
    .select('internacao_id')
    .eq('id', evolucaoId)
    .maybeSingle()

  // Objetos antes da linha: o Storage exige a linha para autorizar a remoção.
  const { data: anexos, error: erroAnexos } = await supabase
    .from('anexos')
    .select('storage_path')
    .eq('evolucao_id', evolucaoId)
  if (erroAnexos) throw new Error(MENSAGEM_GENERICA)
  const caminhos = (anexos ?? []).map((a) => a.storage_path)
  if (!(await removerObjetosAnexo(supabase, caminhos))) throw new Error(MENSAGEM_GENERICA)

  const { error } = await supabase.rpc('descartar_rascunho', { p_evolucao_id: evolucaoId })
  if (error) throw new Error(mensagemDeErro(error))

  if (evolucao) revalidatePath(`/internacoes/${evolucao.internacao_id}`)
}

export async function trocarLeito(internacaoId: string, leito: string): Promise<{ erro?: string }> {
  await exigirProfissional()
  const supabase = await createClient()

  const { error } = await supabase.rpc('trocar_leito', {
    p_internacao_id: internacaoId,
    p_leito_ala: leito.trim(),
  })
  if (error) return { erro: mensagemDeErro(error) }

  revalidatePath(`/internacoes/${internacaoId}`)
  revalidatePath('/')
  return {}
}
