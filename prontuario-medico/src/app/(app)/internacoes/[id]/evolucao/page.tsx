import { notFound, redirect } from 'next/navigation'
import type { AnexoRascunho } from '@/features/anexos/enviar-anexo'
import { FormMedica } from '@/features/evolucao/form-medica'
import { FormSimples } from '@/features/evolucao/form-simples'
import { lerDadosMedica, type EvolucaoTimeline } from '@/features/evolucao/cartao-evolucao'
import { categoriaAusente, exigeConselho, PERFIS_QUE_EVOLUEM, podeEvoluirNaInternacao } from '@/features/evolucao/permissoes'
import { lerDadosSimples } from '@/features/evolucao/modelos/simples'
import { exigirProfissional } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function PaginaNovaEvolucao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const profissional = await exigirProfissional()
  if (!(PERFIS_QUE_EVOLUEM as readonly string[]).includes(profissional.perfil)) redirect(`/internacoes/${id}`)

  const conselhoCompleto = Boolean(
    profissional.conselho && profissional.numero_conselho && profissional.uf_conselho,
  )
  if (exigeConselho(profissional.perfil) && !conselhoCompleto) redirect(`/internacoes/${id}`)

  // Multiprofissional escreve com o modelo da própria categoria; médico, residente e acadêmico com o médico.
  const formularioMedico = profissional.perfil !== 'multiprofissional'
  if (!formularioMedico && categoriaAusente(profissional.perfil, profissional.categoria)) redirect(`/internacoes/${id}`)

  const supabase = await createClient()
  const { data: linha } = await supabase
    .from('vw_internacoes_lista')
    .select('nome, leito_ala, status, equipe_id')
    .eq('internacao_id', id)
    .maybeSingle()
  if (!linha) notFound()
  // Internação com alta só abre para o rascunho de adendo (checado abaixo).
  if (linha.status !== 'INTERNADO' && linha.status !== 'ALTA') redirect(`/internacoes/${id}`)

  const [{ data: rascunho }, { data: aguardando }, { data: anterior }] = await Promise.all([
    supabase
      .from('evolucoes')
      .select('id, dados, texto_livre, devolvida_motivo, adendo_de')
      .eq('internacao_id', id)
      .eq('autor_id', profissional.id)
      .eq('status', 'RASCUNHO')
      .maybeSingle(),
    supabase
      .from('evolucoes')
      .select('id')
      .eq('internacao_id', id)
      .eq('autor_id', profissional.id)
      .eq('status', 'AGUARDANDO_VALIDACAO')
      .maybeSingle(),
    formularioMedico
      ? supabase
          .from('evolucoes')
          .select('dados')
          .eq('internacao_id', id)
          .eq('categoria', 'medica')
          .eq('status', 'FINALIZADA')
          .order('finalizada_em', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // Com evolução aguardando validação não há o que editar: volta ao prontuário.
  if (aguardando) redirect(`/internacoes/${id}`)
  if (linha.status === 'ALTA' && !rascunho?.adendo_de) redirect(`/internacoes/${id}`)
  // Rascunho de adendo é do próprio autor (a consulta filtra por autor): ele continua mesmo sem estar na equipe.
  // Demais rascunhos e novas evoluções exigem a regra de equipe.
  if (
    !rascunho?.adendo_de &&
    !(await podeEvoluirNaInternacao(supabase, profissional.perfil, profissional.id, linha.equipe_id))
  ) {
    redirect(`/internacoes/${id}`)
  }

  const anexosRascunho = rascunho ? await anexosConfirmados(supabase, rascunho.id) : []
  const paciente = { nome: linha.nome, leito: linha.leito_ala }
  const adendo = rascunho?.adendo_de ? await original(supabase, rascunho.adendo_de) : null

  if (!formularioMedico) {
    return (
      <FormSimples
        key={id}
        internacaoId={id}
        userId={profissional.id}
        categoria={profissional.categoria ?? ''}
        paciente={paciente}
        rascunho={
          rascunho
            ? {
                id: rascunho.id,
                dados: lerDadosSimples(rascunho.dados),
                textoLivre: rascunho.texto_livre,
                devolvidaMotivo: rascunho.devolvida_motivo,
              }
            : null
        }
        anexos={anexosRascunho}
        adendo={adendo}
      />
    )
  }

  return (
    <FormMedica
      key={id}
      internacaoId={id}
      userId={profissional.id}
      perfil={profissional.perfil}
      paciente={paciente}
      rascunho={
        rascunho
          ? {
              id: rascunho.id,
              dados: lerDadosMedica(rascunho.dados),
              textoLivre: rascunho.texto_livre,
              devolvidaMotivo: rascunho.devolvida_motivo,
            }
          : null
      }
      anterior={anterior ? lerDadosMedica(anterior.dados) : null}
      anexos={anexosRascunho}
      adendo={adendo}
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
