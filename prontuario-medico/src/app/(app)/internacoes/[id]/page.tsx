import { FileText, Stethoscope } from 'lucide-react'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CartaoSecao } from '@/components/layout/cartao-secao'
import { BarraAcoes, PilulaStatus } from '@/components/layout/barra-acoes'
import { CabecalhoPaciente } from '@/features/internacoes/cabecalho-paciente'
import { MarcarAba } from '@/components/navegacao-ativa'
import { BotaoImprimirEvolucao } from '@/features/evolucao/botao-imprimir'
import type { EvolucaoTimeline } from '@/features/evolucao/cartao-evolucao'
import { Ficha } from '@/features/evolucao/ficha'
import { horaLimiteReabertura, podeReabrir } from '@/features/evolucao/reabertura'
import { statusDoDia } from '@/features/evolucao/status-dia'
import { HistoricoAbas } from '@/features/evolucao/historico-abas'
import {
  categoriaAusente,
  ehMembroDaEquipe,
  exigeConselho,
  PERFIS_QUE_EVOLUEM,
  podeCriarAdendo,
  podeEvoluirNaInternacao,
} from '@/features/evolucao/permissoes'
import { DialogAlta } from '@/features/alta/dialog-alta'
import { listarAnexosInternacao } from '@/features/anexos/consultas'
import { exigirNaoAdmin } from '@/lib/auth'
import { diasEntre } from '@/lib/datas'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PERFIS_NAO_CLINICOS = ['recepcao', 'admin'] as const

export default async function PaginaProntuario({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const profissional = await exigirNaoAdmin()
  const supabase = await createClient()

  const { data: linha } = await supabase
    .from('vw_internacoes_lista')
    .select('*')
    .eq('internacao_id', id)
    .maybeSingle()
  if (!linha) notFound()

  await supabase.rpc('registrar_acesso', { p_internacao_id: id, p_acao: 'abrir_prontuario' })

  const clinico = !(PERFIS_NAO_CLINICOS as readonly string[]).includes(profissional.perfil)
  const [{ data: evolucoes }, anexosGaleria, { data: quadro }] = await Promise.all([
    clinico
      ? supabase
          .from('vw_evolucoes_timeline')
          .select('id, status, categoria, autor_nome, autor_id, criado_em, finalizada_em, dados, texto_livre, qtd_anexos, adendo_de, validada_por, vias_impressas')
          .eq('internacao_id', id)
          .order('criado_em', { ascending: false })
      : Promise.resolve({ data: [] }),
    clinico ? listarAnexosInternacao(id) : Promise.resolve([]),
    clinico
      ? supabase.from('internacoes_clinico').select('diagnostico_inicial, comorbidades, muc').eq('internacao_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const perfilEvolui = (PERFIS_QUE_EVOLUEM as readonly string[]).includes(profissional.perfil)
  const conselhoCompleto =
    !exigeConselho(profissional.perfil) ||
    Boolean(profissional.conselho && profissional.numero_conselho && profissional.uf_conselho)
  const categoriaOk = !categoriaAusente(profissional.perfil, profissional.categoria)
  const membroEquipe = clinico && perfilEvolui ? await ehMembroDaEquipe(supabase, profissional.id, linha.equipe_id) : false
  const podeAbrirAdendo = clinico && perfilEvolui && conselhoCompleto && categoriaOk

  const rascunhoProprio = (evolucoes ?? []).find(
    (e) => e.status === 'RASCUNHO' && e.autor_id === profissional.id,
  )
  // Enquanto a evolução própria aguarda validação, não há nova evolução (o banco também recusa).
  const aguardandoProprio = (evolucoes ?? []).some(
    (e) => e.status === 'AGUARDANDO_VALIDACAO' && e.autor_id === profissional.id,
  )

  // autor_id não vai ao cliente: a coluna serve só para achar o rascunho próprio e calcular podeAdendo aqui.
  // validada_por e vias_impressas também ficam no servidor: só alimentam o cálculo de "reabrir".
  const agora = new Date()
  const reabriveis = (evolucoes ?? []).map((e) => ({
    id: e.id,
    status: e.status,
    autor_id: e.autor_id,
    validada_por: e.validada_por,
    adendo_de: e.adendo_de,
    finalizada_em: e.finalizada_em,
    vias_impressas: e.vias_impressas,
  }))
  const linhasTimeline: EvolucaoTimeline[] = (evolucoes ?? []).map(({ autor_id, validada_por, vias_impressas, ...e }) => ({
    ...e,
    reabrirAte:
      clinico &&
      podeReabrir({ id: e.id, status: e.status, autor_id, validada_por, adendo_de: e.adendo_de, finalizada_em: e.finalizada_em, vias_impressas }, reabriveis, {
        perfil: profissional.perfil,
        usuarioId: profissional.id,
        internacaoInternada: linha.status === 'INTERNADO',
        temRascunhoProprio: Boolean(rascunhoProprio),
        agora,
      }) && e.finalizada_em
        ? horaLimiteReabertura(e.finalizada_em)
        : undefined,
    podeAdendo:
      podeAbrirAdendo &&
      !rascunhoProprio &&
      !aguardandoProprio &&
      e.status === 'FINALIZADA' &&
      podeCriarAdendo(profissional.perfil, autor_id === profissional.id, membroEquipe),
  }))
  const podeEvoluirEquipe =
    perfilEvolui && (await podeEvoluirNaInternacao(supabase, profissional.perfil, profissional.id, linha.equipe_id))

  const podeDarAlta = linha.status === 'INTERNADO' && clinico && profissional.perfil === 'medico' && membroEquipe

  const ficha = (() => {
    if (!clinico || !perfilEvolui || !podeEvoluirEquipe) return null
    if (linha.status === 'ALTA') {
      // Em internação com alta só o adendo continua aberto: o rascunho de adendo é retomado daqui.
      return rascunhoProprio?.adendo_de && conselhoCompleto && categoriaOk ? 'ficha' : null
    }
    if (aguardandoProprio) return 'aguardando'
    if (!categoriaOk) return 'sem-categoria'
    if (!conselhoCompleto) return 'sem-conselho'
    return 'ficha'
  })()
  // Muda quando uma evolução própria é concluída: a ficha recomeça vazia.
  const ciclo = String((evolucoes ?? []).filter((e) => e.autor_id === profissional.id && e.status !== 'RASCUNHO').length)

  const finalizadas = linhasTimeline.filter((e) => e.status === 'FINALIZADA')
  const diasInternado = diasEntre(linha.admitido_em, linha.status === 'ALTA' && linha.alta_em ? new Date(linha.alta_em) : new Date())
  const { data: devolvidaRow } = rascunhoProprio
    ? await supabase.from('evolucoes').select('devolvida_motivo').eq('id', rascunhoProprio.id).maybeSingle()
    : { data: null }
  const statusDia = statusDoDia({
    internacaoAlta: linha.status === 'ALTA',
    rascunhoProprio: Boolean(rascunhoProprio),
    devolvidaParaMim: Boolean(devolvidaRow?.devolvida_motivo),
    aguardandoProprio,
    finalizadaHoje: linha.status_hoje === 'FINALIZADA',
  })

  const quadroItens = (
    [
      ['Diagnóstico inicial', quadro?.diagnostico_inicial],
      ['Comorbidades', quadro?.comorbidades],
      ['MUC (medicamentos de uso contínuo)', quadro?.muc],
    ] as const
  ).flatMap(([rotulo, valor]) => (valor?.trim() ? [[rotulo, valor.trim()] as const] : []))

  return (
    <>
      <MarcarAba status={linha.status} />
      <CabecalhoPaciente linha={linha} diasInternado={diasInternado} />

      <BarraAcoes status={<PilulaStatus tipo={statusDia.tipo}>{statusDia.texto}</PilulaStatus>}>
        {finalizadas[0] && <BotaoImprimirEvolucao evolucaoId={finalizadas[0].id} rotulo="Imprimir evolução" destaque />}
        {podeDarAlta && <DialogAlta internacaoId={id} />}
        {linha.status === 'ALTA' && clinico && (
          <Button asChild variant="contorno-teal" size="compacto">
            <a href={`/internacoes/${id}/alta/pdf`} target="_blank" rel="noopener">
              <FileText aria-hidden />
              Folha de alta (PDF)
            </a>
          </Button>
        )}
      </BarraAcoes>

      {ficha === 'sem-categoria' && (
        <p className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          Complete sua categoria profissional com o administrador para registrar evoluções.
        </p>
      )}
      {ficha === 'sem-conselho' && (
        <p className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          Complete seu registro profissional (conselho, número e UF) para registrar evoluções.
        </p>
      )}
      {ficha === 'aguardando' && (
        <p role="status" className="rounded-lg bg-muted p-3 font-semibold text-muted-foreground">
          Você tem uma evolução aguardando validação.
        </p>
      )}
      {ficha === 'ficha' && (
        <div id="ficha" className="min-w-0 scroll-mt-4">
          <Ficha internacaoId={id} profissional={profissional} ciclo={ciclo} />
        </div>
      )}

      {quadroItens.length > 0 && (
        <CartaoSecao titulo="Quadro de admissão" icone={Stethoscope}>
          <dl className="grid items-start gap-4 sm:grid-cols-3">
            {quadroItens.map(([rotulo, valor]) => (
              <div key={rotulo} className="min-w-0">
                <dt className="text-[11px] font-bold uppercase text-slate-700">{rotulo}</dt>
                <dd className="mt-1 whitespace-pre-line wrap-break-word text-slate-900">{valor}</dd>
              </div>
            ))}
          </dl>
        </CartaoSecao>
      )}

      {clinico ? (
        <HistoricoAbas evolucoes={finalizadas} anexos={anexosGaleria} somenteConsulta={linha.status === 'ALTA'} />
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-muted-foreground">
          Conteúdo clínico disponível apenas para profissionais de saúde.
        </p>
      )}
      {/* Reserva o espaço do rodapé fixo da ficha no celular, depois do histórico. */}
      {ficha === 'ficha' && <div aria-hidden className="h-[calc(6rem+env(safe-area-inset-bottom))] sm:hidden" />}
    </>
  )
}
