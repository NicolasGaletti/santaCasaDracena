import { FileText } from 'lucide-react'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BarraAcoes, PilulaStatus, type TipoStatus } from '@/components/layout/barra-acoes'
import { CabecalhoPaciente } from '@/features/internacoes/cabecalho-paciente'
import { MarcarAba } from '@/components/navegacao-ativa'
import { BotaoImprimirEvolucao } from '@/features/evolucao/botao-imprimir'
import type { EvolucaoTimeline } from '@/features/evolucao/cartao-evolucao'
import { Ficha } from '@/features/evolucao/ficha'
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
  const [{ data: evolucoes }, anexosGaleria] = await Promise.all([
    clinico
      ? supabase
          .from('vw_evolucoes_timeline')
          .select('id, status, categoria, autor_nome, autor_id, criado_em, finalizada_em, dados, texto_livre, qtd_anexos, adendo_de')
          .eq('internacao_id', id)
          .order('criado_em', { ascending: false })
      : Promise.resolve({ data: [] }),
    clinico ? listarAnexosInternacao(id) : Promise.resolve([]),
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

  // autor_id fica de fora do cartão; a coluna serve só para achar o rascunho próprio.
  const linhasTimeline: EvolucaoTimeline[] = (evolucoes ?? []).map((e) => ({
    ...e,
    podeAdendo:
      podeAbrirAdendo &&
      !rascunhoProprio &&
      !aguardandoProprio &&
      e.status === 'FINALIZADA' &&
      podeCriarAdendo(profissional.perfil, e.autor_id === profissional.id, membroEquipe),
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
  const statusDia: { tipo: TipoStatus; texto: string } =
    linha.status === 'ALTA'
      ? { tipo: 'alta', texto: 'Internação com alta' }
      : aguardandoProprio
        ? { tipo: 'aguardando', texto: 'Aguardando validação' }
        : rascunhoProprio
          ? { tipo: 'rascunho', texto: 'Rascunho de hoje' }
          : linha.status_hoje === 'FINALIZADA'
          ? { tipo: 'finalizada', texto: 'Evoluído hoje' }
          : linha.status_hoje === 'RASCUNHO'
            ? { tipo: 'rascunho', texto: 'Rascunho de hoje' }
            : { tipo: 'nenhuma', texto: 'Sem evolução hoje' }

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

      {linha.status === 'ALTA' && (
        <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">
          Internação com alta: prontuário somente para consulta.
        </p>
      )}

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

      {clinico ? (
        <HistoricoAbas evolucoes={finalizadas} anexos={anexosGaleria} />
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-muted-foreground">
          Conteúdo clínico disponível apenas para profissionais de saúde.
        </p>
      )}
    </>
  )
}
