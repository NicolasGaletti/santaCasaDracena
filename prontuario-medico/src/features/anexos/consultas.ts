import { createClient } from '@/lib/supabase/server'
import type { TipoAnexo } from './rotulos'

/** Anexo confirmado de uma evolução finalizada, pronto para a galeria (sem caminho do objeto). */
export type AnexoGaleria = {
  id: string
  tipo: TipoAnexo
  descricao: string
  dataExame: string
  mime: string
  evolucaoId: string
  autorNome: string
}

/**
 * Anexos confirmados das evoluções finalizadas da internação, mais recentes primeiro. A RLS de
 * `anexos` e de `vw_evolucoes_timeline` já barra perfil não clínico; o filtro de status é explícito.
 */
export async function listarAnexosInternacao(internacaoId: string): Promise<AnexoGaleria[]> {
  const supabase = await createClient()

  const { data: evolucoes } = await supabase
    .from('vw_evolucoes_timeline')
    .select('id, autor_nome')
    .eq('internacao_id', internacaoId)
    .eq('status', 'FINALIZADA')
  const autores = new Map<string, string>()
  for (const e of evolucoes ?? []) {
    if (e.id) autores.set(e.id, e.autor_nome ?? '')
  }
  if (autores.size === 0) return []

  const { data: anexos } = await supabase
    .from('anexos')
    .select('id, tipo, descricao, data_exame, mime, evolucao_id')
    .eq('internacao_id', internacaoId)
    .eq('confirmado', true)
    .in('evolucao_id', [...autores.keys()])
    .order('data_exame', { ascending: false })
    .order('enviado_em', { ascending: false })

  return (anexos ?? []).map((a) => ({
    id: a.id,
    tipo: a.tipo,
    descricao: a.descricao,
    dataExame: a.data_exame,
    mime: a.mime,
    evolucaoId: a.evolucao_id,
    autorNome: autores.get(a.evolucao_id) ?? '',
  }))
}
