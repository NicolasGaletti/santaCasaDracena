import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CabecalhoPaciente } from '@/features/internacoes/cabecalho-paciente'
import { Timeline } from '@/features/evolucao/timeline'
import type { EvolucaoTimeline } from '@/features/evolucao/cartao-evolucao'
import { exigirProfissional } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PERFIS_CLINICOS_QUE_EVOLUEM = ['medico', 'residente'] as const
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
  const [{ data: dadosClinicos }, { data: evolucoes }] = await Promise.all([
    clinico
      ? supabase
          .from('internacoes_clinico')
          .select('diagnostico_inicial, comorbidades, muc')
          .eq('internacao_id', id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('vw_evolucoes_timeline')
      .select('id, status, categoria, autor_nome, autor_id, criado_em, finalizada_em, dados, texto_livre')
      .eq('internacao_id', id)
      .order('criado_em', { ascending: false }),
  ])

  // autor_id fica de fora do cartão; a coluna serve só para achar o rascunho próprio.
  const linhasTimeline: EvolucaoTimeline[] = evolucoes ?? []
  const rascunhoProprio = (evolucoes ?? []).find(
    (e) => e.status === 'RASCUNHO' && e.autor_id === profissional.id,
  )

  const podeEvoluir = linha.status === 'INTERNADO' && (PERFIS_CLINICOS_QUE_EVOLUEM as readonly string[]).includes(profissional.perfil)
  const crmCompleto = Boolean(
    profissional.conselho && profissional.numero_conselho && profissional.uf_conselho,
  )

  return (
    <>
      <CabecalhoPaciente linha={linha} />

      {podeEvoluir && (
        <div className="flex flex-col gap-2">
          {rascunhoProprio ? (
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={`/internacoes/${id}/evolucao`}>Continuar rascunho</Link>
            </Button>
          ) : crmCompleto ? (
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={`/internacoes/${id}/evolucao`}>Nova evolução</Link>
            </Button>
          ) : (
            <p className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
              Complete seu registro profissional (CRM, número e UF) para registrar evoluções.
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
          </TabsList>
          <TabsContent value="evolucoes">
            <Timeline evolucoes={linhasTimeline} />
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
        <Timeline evolucoes={linhasTimeline} />
      )}
    </>
  )
}
