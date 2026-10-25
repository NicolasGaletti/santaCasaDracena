import { notFound, redirect } from 'next/navigation'
import { FormMedica } from '@/features/evolucao/form-medica'
import { lerDadosMedica } from '@/features/evolucao/cartao-evolucao'
import { podeEvoluirNaInternacao } from '@/features/evolucao/permissoes'
import { exigirProfissional } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PERFIS_QUE_EVOLUEM = ['medico', 'residente'] as const

export default async function PaginaNovaEvolucao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const profissional = await exigirProfissional()
  if (!(PERFIS_QUE_EVOLUEM as readonly string[]).includes(profissional.perfil)) redirect(`/internacoes/${id}`)

  const crmCompleto = Boolean(
    profissional.conselho && profissional.numero_conselho && profissional.uf_conselho,
  )
  if (!crmCompleto) redirect(`/internacoes/${id}`)

  const supabase = await createClient()
  const { data: linha } = await supabase
    .from('vw_internacoes_lista')
    .select('nome, leito_ala, status, equipe_id')
    .eq('internacao_id', id)
    .maybeSingle()
  if (!linha) notFound()
  if (linha.status !== 'INTERNADO') redirect(`/internacoes/${id}`)
  if (!(await podeEvoluirNaInternacao(supabase, profissional.perfil, profissional.id, linha.equipe_id))) {
    redirect(`/internacoes/${id}`)
  }

  const [{ data: rascunho }, { data: anterior }] = await Promise.all([
    supabase
      .from('evolucoes')
      .select('id, dados, texto_livre')
      .eq('internacao_id', id)
      .eq('autor_id', profissional.id)
      .eq('status', 'RASCUNHO')
      .maybeSingle(),
    supabase
      .from('evolucoes')
      .select('dados')
      .eq('internacao_id', id)
      .eq('categoria', 'medica')
      .eq('status', 'FINALIZADA')
      .order('finalizada_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <FormMedica
      key={id}
      internacaoId={id}
      userId={profissional.id}
      perfil={profissional.perfil}
      paciente={{ nome: linha.nome, leito: linha.leito_ala }}
      rascunho={
        rascunho
          ? {
              id: rascunho.id,
              dados: lerDadosMedica(rascunho.dados),
              textoLivre: rascunho.texto_livre,
            }
          : null
      }
      anterior={anterior ? lerDadosMedica(anterior.dados) : null}
    />
  )
}
