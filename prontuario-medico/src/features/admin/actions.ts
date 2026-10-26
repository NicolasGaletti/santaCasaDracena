'use server'

import { revalidatePath } from 'next/cache'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { exigirAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { funcaoPorValor } from './funcoes'

const GENERICA = 'Não foi possível concluir a operação. Tente novamente.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Supabase = Awaited<ReturnType<typeof createClient>>
export type Resultado = { erro?: string }

type DadosProfissional = {
  nome: string
  funcao: string
  conselho: string
  numero: string
  uf: string
  equipeIds: string[]
}

function depois() {
  revalidatePath('/admin', 'layout')
}

/** Mensagens P0001 do banco são pt-BR e seguem para a tela; o resto vira a mensagem genérica. */
function mensagemBanco(error: { code?: string; message: string }): string {
  return error.code === 'P0001' ? error.message : GENERICA
}

/** Chama a Edge Function com o JWT da sessão do admin (service_role fica só na função). */
async function chamarFuncao(
  supabase: Supabase,
  corpo: Record<string, unknown>,
): Promise<{ erro?: string; id?: string }> {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: corpo })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const resposta = (await error.context.json().catch(() => null)) as { erro?: string } | null
      return { erro: resposta?.erro ?? GENERICA }
    }
    return { erro: GENERICA }
  }
  return { id: (data as { id?: string } | null)?.id }
}

async function sincronizarEquipes(
  supabase: Supabase,
  profissionalId: string,
  desejadas: string[],
  atuais: string[],
): Promise<string | null> {
  for (const equipeId of desejadas.filter((e) => !atuais.includes(e))) {
    const { error } = await supabase.rpc('admin_vincular', { p_profissional_id: profissionalId, p_equipe_id: equipeId })
    if (error) return mensagemBanco(error)
  }
  for (const equipeId of atuais.filter((e) => !desejadas.includes(e))) {
    const { error } = await supabase.rpc('admin_desvincular', { p_profissional_id: profissionalId, p_equipe_id: equipeId })
    if (error) return mensagemBanco(error)
  }
  return null
}

function idsValidos(ids: string[]): boolean {
  return Array.isArray(ids) && ids.every((i) => UUID.test(i))
}

export async function convidarProfissional(dados: DadosProfissional & { email: string }): Promise<Resultado> {
  await exigirAdmin()
  if (!idsValidos(dados.equipeIds)) return { erro: GENERICA }
  const supabase = await createClient()
  const r = await chamarFuncao(supabase, {
    acao: 'convidar',
    email: dados.email,
    nome: dados.nome,
    funcao: dados.funcao,
    conselho: dados.conselho,
    numero: dados.numero,
    uf: dados.uf,
  })
  if (r.erro) return { erro: r.erro }
  if (r.id && dados.equipeIds.length > 0) {
    const falha = await sincronizarEquipes(supabase, r.id, dados.equipeIds, [])
    if (falha) {
      depois()
      return { erro: `Convite enviado, mas não foi possível vincular às equipes: ${falha} Edite o profissional para vincular.` }
    }
  }
  depois()
  return {}
}

export async function atualizarProfissional(
  id: string,
  dados: DadosProfissional,
  equipesAtuais: string[],
): Promise<Resultado> {
  await exigirAdmin()
  const funcao = funcaoPorValor(dados.funcao)
  if (!UUID.test(id) || !funcao || !idsValidos(dados.equipeIds) || !idsValidos(equipesAtuais)) {
    return { erro: 'Selecione a função do profissional.' }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_atualizar_profissional', {
    p_id: id,
    p_nome: dados.nome,
    p_perfil: funcao.perfil,
    // @ts-expect-error p_categoria aceita nulo (tipos gerados não marcam argumentos opcionais)
    p_categoria: funcao.categoria,
    p_conselho: funcao.conselho ? dados.conselho : '',
    p_numero: funcao.conselho ? dados.numero : '',
    p_uf: funcao.conselho ? dados.uf : '',
  })
  if (error) return { erro: mensagemBanco(error) }
  const falha = await sincronizarEquipes(supabase, id, dados.equipeIds, equipesAtuais)
  depois()
  return falha ? { erro: falha } : {}
}

export async function reenviarConvite(profissionalId: string): Promise<Resultado> {
  await exigirAdmin()
  if (!UUID.test(profissionalId)) return { erro: GENERICA }
  const r = await chamarFuncao(await createClient(), { acao: 'reenviar', profissionalId })
  return r.erro ? { erro: r.erro } : {}
}

export async function alterarAtivo(profissionalId: string, ativo: boolean): Promise<Resultado> {
  await exigirAdmin()
  if (!UUID.test(profissionalId)) return { erro: GENERICA }
  const r = await chamarFuncao(await createClient(), {
    acao: ativo ? 'reativar' : 'desativar',
    profissionalId,
  })
  if (r.erro) return { erro: r.erro }
  depois()
  return {}
}

export async function salvarEquipe(id: string | null, nome: string, ativo: boolean | null): Promise<Resultado> {
  await exigirAdmin()
  if (id !== null && !UUID.test(id)) return { erro: GENERICA }
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_salvar_equipe', {
    // @ts-expect-error p_id nulo cria a equipe (tipos gerados não marcam argumentos opcionais)
    p_id: id,
    p_nome: nome,
    // @ts-expect-error p_ativo nulo mantém o valor atual
    p_ativo: ativo,
  })
  if (error) return { erro: mensagemBanco(error) }
  depois()
  return {}
}

export async function vincularMembro(profissionalId: string, equipeId: string, vincular: boolean): Promise<Resultado> {
  await exigirAdmin()
  if (!UUID.test(profissionalId) || !UUID.test(equipeId)) return { erro: GENERICA }
  const supabase = await createClient()
  const { error } = await supabase.rpc(vincular ? 'admin_vincular' : 'admin_desvincular', {
    p_profissional_id: profissionalId,
    p_equipe_id: equipeId,
  })
  if (error) return { erro: mensagemBanco(error) }
  depois()
  return {}
}
