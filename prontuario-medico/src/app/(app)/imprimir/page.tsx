import { redirect } from 'next/navigation'
import { FilaImpressao, type LinhaFila } from '@/features/impressao/fila-impressao'
import { formatarDataHora } from '@/features/evolucao/cartao-evolucao'
import { listarEquipes, listarMedicos } from '@/features/internacoes/consultas'
import { exigirNaoAdmin } from '@/lib/auth'
import { hojeSP } from '@/lib/datas'
import { createClient } from '@/lib/supabase/server'

const PERFIS_NAO_CLINICOS = ['recepcao', 'admin'] as const
const DIA = /^\d{4}-\d{2}-\d{2}$/

type Params = { dia?: string; medico?: string; equipe?: string }

/** Início e fim do dia de São Paulo (sem horário de verão desde 2019). */
function intervaloDoDia(dia: string): { inicio: string; fim: string } {
  const inicio = new Date(`${dia}T00:00:00-03:00`)
  return { inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 86_400_000).toISOString() }
}

export default async function PaginaImprimir({ searchParams }: { searchParams: Promise<Params> }) {
  const profissional = await exigirNaoAdmin()
  if ((PERFIS_NAO_CLINICOS as readonly string[]).includes(profissional.perfil)) redirect('/')

  const params = await searchParams
  const dia = params.dia && DIA.test(params.dia) ? params.dia : hojeSP()
  const medico = params.medico ?? 'eu'
  const medicoId = medico === 'eu' ? profissional.id : medico === 'todos' ? undefined : medico

  const supabase = await createClient()
  const [equipes, medicos] = await Promise.all([listarEquipes(), listarMedicos()])
  const equipeId = equipes.some((e) => e.id === params.equipe) ? params.equipe : undefined
  const { inicio, fim } = intervaloDoDia(dia)

  let consulta = supabase
    .from('vw_evolucoes_timeline')
    .select('id, internacao_id, validada_por, finalizada_em, snapshot_autor, snapshot_validador')
    .eq('status', 'FINALIZADA')
    .eq('vias_impressas', 0)
    .gte('finalizada_em', inicio)
    .lt('finalizada_em', fim)
    .order('finalizada_em', { ascending: true })
  if (medicoId) consulta = consulta.eq('validada_por', medicoId)
  const { data: evolucoes, error } = await consulta
  if (error) throw new Error(error.message)

  const internacaoIds = [...new Set((evolucoes ?? []).map((e) => e.internacao_id))]
  const { data: internacoes } = internacaoIds.length
    ? await supabase
        .from('vw_internacoes_lista')
        .select('internacao_id, nome, leito_ala, equipe_id, equipe_nome')
        .in('internacao_id', internacaoIds)
    : { data: [] }
  const internacaoPorId = new Map((internacoes ?? []).map((i) => [i.internacao_id, i]))

  const linhas: LinhaFila[] = (evolucoes ?? []).flatMap((e) => {
    const internacao = internacaoPorId.get(e.internacao_id)
    if (!internacao || !e.finalizada_em) return []
    if (equipeId && internacao.equipe_id !== equipeId) return []
    const validador = (e.snapshot_validador ?? e.snapshot_autor) as { nome?: string } | null
    return [
      {
        id: e.id ?? '',
        paciente: internacao.nome ?? '',
        leito: internacao.leito_ala ?? '',
        equipe: internacao.equipe_nome ?? '',
        validador: validador?.nome ?? 'Identificação não disponível',
        horario: formatarDataHora(e.finalizada_em),
      },
    ]
  })

  const campo = 'h-11 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-base md:text-sm'

  return (
    <>
      <h1 className="text-xl font-bold">Imprimir evoluções</h1>

      <form method="get" aria-label="Filtrar evoluções para impressão" className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Equipe
          <select name="equipe" defaultValue={equipeId ?? ''} className={campo}>
            <option value="">Todas as equipes</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Médico validador
          <select name="medico" defaultValue={medico} className={campo}>
            <option value="eu">Eu ({profissional.nome})</option>
            <option value="todos">Todos os médicos</option>
            {medicos
              .filter((m) => m.id !== profissional.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Dia
          <input type="date" name="dia" defaultValue={dia} className={campo} />
        </label>
        <div className="sm:col-span-3">
          <button
            type="submit"
            className="inline-flex h-11 items-center rounded-lg border border-border bg-background px-5 font-medium hover:bg-muted"
          >
            Filtrar
          </button>
        </div>
      </form>

      <FilaImpressao key={`${dia}-${medico}-${equipeId ?? ''}`} linhas={linhas} />
    </>
  )
}
