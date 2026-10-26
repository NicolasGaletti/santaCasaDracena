import type { AnexoRascunho } from '@/features/anexos/enviar-anexo'
import { createClient } from '@/lib/supabase/server'
import { lerDadosMedica, type EvolucaoTimeline } from './cartao-evolucao'
import { FichaCliente } from './ficha-cliente'
import { lerDadosSimples } from './modelos/simples'

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Ficha de evolução do prontuário: carrega o rascunho do usuário (com anexos, adendo e quem devolveu)
 * e monta o formulário do perfil. A permissão de evoluir já foi decidida pela página.
 */
export async function Ficha({
  internacaoId,
  profissional,
  ciclo,
}: {
  internacaoId: string
  profissional: { id: string; perfil: string; categoria: string | null }
  ciclo: string
}) {
  const supabase = await createClient()
  // Multiprofissional escreve com o modelo da própria categoria; médico, residente e acadêmico com o médico.
  const formularioMedico = profissional.perfil !== 'multiprofissional'

  const [{ data: rascunho }, { data: anterior }] = await Promise.all([
    supabase
      .from('evolucoes')
      .select('id, dados, texto_livre, devolvida_motivo, devolvida_por, adendo_de')
      .eq('internacao_id', internacaoId)
      .eq('autor_id', profissional.id)
      .eq('status', 'RASCUNHO')
      .maybeSingle(),
    formularioMedico
      ? supabase
          .from('evolucoes')
          .select('dados')
          .eq('internacao_id', internacaoId)
          .eq('categoria', 'medica')
          .eq('status', 'FINALIZADA')
          .order('finalizada_em', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const { data: devolvedor } = rascunho?.devolvida_por
    ? await supabase.from('vw_profissionais_publico').select('nome').eq('id', rascunho.devolvida_por).maybeSingle()
    : { data: null }
  const devolvidaPorNome = devolvedor?.nome ?? null

  const anexos = rascunho ? await anexosConfirmados(supabase, rascunho.id) : []
  const adendo = rascunho?.adendo_de ? await original(supabase, rascunho.adendo_de) : null
  const base = { internacaoId, userId: profissional.id, anexos, adendo, ciclo }
  const comum = rascunho && {
    id: rascunho.id,
    textoLivre: rascunho.texto_livre,
    devolvidaMotivo: rascunho.devolvida_motivo,
    devolvidaPorNome,
  }

  if (!formularioMedico) {
    return (
      <FichaCliente
        {...base}
        tipo="simples"
        categoria={profissional.categoria ?? ''}
        rascunho={comum ? { ...comum, dados: lerDadosSimples(rascunho.dados) } : null}
      />
    )
  }
  return (
    <FichaCliente
      {...base}
      tipo="medica"
      perfil={profissional.perfil}
      rascunho={comum ? { ...comum, dados: lerDadosMedica(rascunho.dados) } : null}
      anterior={anterior ? lerDadosMedica(anterior.dados) : null}
    />
  )
}

/** Evolução original do adendo, para o cabeçalho do formulário. Só visível a quem o banco deixa ler. */
async function original(supabase: Supabase, evolucaoId: string): Promise<EvolucaoTimeline | null> {
  const { data } = await supabase
    .from('vw_evolucoes_timeline')
    .select('id, status, categoria, autor_nome, criado_em, finalizada_em, dados, texto_livre, qtd_anexos, adendo_de')
    .eq('id', evolucaoId)
    .maybeSingle()
  return data ?? null
}

/** Anexos confirmados do rascunho, com URL assinada de 300 s para a prévia (gerada no servidor). */
async function anexosConfirmados(supabase: Supabase, evolucaoId: string): Promise<AnexoRascunho[]> {
  const { data } = await supabase
    .from('anexos')
    .select('id, tipo, descricao, data_exame, mime, storage_path')
    .eq('evolucao_id', evolucaoId)
    .eq('confirmado', true)
    .order('enviado_em', { ascending: true })
  if (!data) return []

  return Promise.all(
    data.map(async (a) => {
      const { data: assinada } = await supabase.storage.from('anexos').createSignedUrl(a.storage_path, 300)
      return {
        id: a.id,
        tipo: a.tipo,
        descricao: a.descricao,
        dataExame: a.data_exame,
        mime: a.mime,
        previewUrl: assinada?.signedUrl,
      }
    }),
  )
}
