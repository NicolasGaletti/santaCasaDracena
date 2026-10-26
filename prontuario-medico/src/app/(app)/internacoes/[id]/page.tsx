import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CabecalhoPaciente } from '@/features/internacoes/cabecalho-paciente'
import { MarcarAba } from '@/components/navegacao-ativa'
import { Timeline } from '@/features/evolucao/timeline'
import type { EvolucaoTimeline } from '@/features/evolucao/cartao-evolucao'
import {
  categoriaAusente,
  ehMembroDaEquipe,
  exigeConselho,
  PERFIS_QUE_EVOLUEM,
  podeCriarAdendo,
  podeEvoluirNaInternacao,
} from '@/features/evolucao/permissoes'
import { listarAnexosInternacao } from '@/features/anexos/consultas'
import { GaleriaExames } from '@/features/anexos/galeria-exames'
import { exigirProfissional } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PERFIS_NAO_CLINICOS = ['recepcao', 'admin'] as const

export default async function PaginaProntuario({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const profissional = await exigirProfissional()
  const supabase = await createClient()

  const { data: linha } = await supabase
    .from('vw_internacoes_lista')
    .select('*')
    .eq('internacao_id', id)
    .maybeSingle()
  if (!linha) notFound()

  await supabase.rpc('registrar_acesso', { p_internacao_id: id, p_acao: 'abrir_prontuario' })

  const clinico = !(PERFIS_NAO_CLINICOS as readonly string[]).includes(profissional.perfil)
  const [{ data: dadosClinicos }, { data: evolucoes }, anexosGaleria] = await Promise.all([
    clinico
      ? supabase
          .from('internacoes_clinico')
          .select('diagnostico_inicial, comorbidades, muc')
          .eq('internacao_id', id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
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
  const podeEvoluir = linha.status === 'INTERNADO' && perfilEvolui && podeEvoluirEquipe

  return (
    <>
      <MarcarAba status={linha.status} />
      <CabecalhoPaciente linha={linha} />

      {/* Em internação com alta só o adendo continua aberto: o rascunho de adendo é retomado daqui. */}
      {linha.status === 'ALTA' && rascunhoProprio?.adendo_de && podeEvoluirEquipe && (
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={`/internacoes/${id}/evolucao`}>Continuar rascunho</Link>
        </Button>
      )}

      {podeEvoluir && (
        <div className="flex flex-col gap-2">
          {categoriaAusente(profissional.perfil, profissional.categoria) ? (
            <p className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
              Complete sua categoria profissional com o administrador para registrar evoluções.
            </p>
          ) : rascunhoProprio ? (
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={`/internacoes/${id}/evolucao`}>Continuar rascunho</Link>
            </Button>
          ) : aguardandoProprio ? (
            <>
              <Button type="button" size="lg" disabled className="w-full sm:w-auto">
                Nova evolução
              </Button>
              <p role="status" className="rounded-lg bg-muted p-3 font-semibold text-muted-foreground">
                Você tem uma evolução aguardando validação.
              </p>
            </>
          ) : conselhoCompleto ? (
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={`/internacoes/${id}/evolucao`}>Nova evolução</Link>
            </Button>
          ) : (
            <p className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
              Complete seu registro profissional (conselho, número e UF) para registrar evoluções.
            </p>
          )}
        </div>
      )}

      {linha.status === 'ALTA' && (
        <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">
          Internação com alta: prontuário somente para consulta.
        </p>
      )}

      {clinico ? (
        <Tabs defaultValue="evolucoes" className="flex flex-col gap-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="evolucoes" className="min-h-11 flex-1 sm:flex-none">
              Evoluções
            </TabsTrigger>
            <TabsTrigger value="dados" className="min-h-11 flex-1 sm:flex-none">
              Dados
            </TabsTrigger>
            <TabsTrigger value="exames" className="min-h-11 flex-1 sm:flex-none">
              Exames
            </TabsTrigger>
          </TabsList>
          <TabsContent value="evolucoes">
            <Timeline evolucoes={linhasTimeline.filter((e) => e.status === 'FINALIZADA')} />
          </TabsContent>
          <TabsContent value="exames">
            <GaleriaExames anexos={anexosGaleria} />
          </TabsContent>
          <TabsContent value="dados">
            <dl className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
              <div>
                <dt className="text-sm font-bold text-muted-foreground">Diagnóstico inicial</dt>
                <dd className="break-words">{dadosClinicos?.diagnostico_inicial || 'Não informado'}</dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-muted-foreground">Comorbidades</dt>
                <dd className="break-words">{dadosClinicos?.comorbidades || 'Não informadas'}</dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-muted-foreground">MUC (medicamentos de uso contínuo)</dt>
                <dd className="break-words">{dadosClinicos?.muc || 'Não informado'}</dd>
              </div>
            </dl>
          </TabsContent>
        </Tabs>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-muted-foreground">
          Conteúdo clínico disponível apenas para profissionais de saúde.
        </p>
      )}
    </>
  )
}
