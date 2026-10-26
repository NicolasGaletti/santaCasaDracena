import Link from 'next/link'
import { CartaoInternacao } from './cartao-internacao'
import type { LinhaInternacao } from './consultas'

type Filtros = { equipe?: string; convenio?: string }

const CLASSE_CHIP =
  'inline-flex min-h-11 shrink-0 snap-start items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors'

function hrefFiltros(caminho: string, filtros: Filtros): string {
  const query = new URLSearchParams()
  if (filtros.equipe) query.set('equipe', filtros.equipe)
  if (filtros.convenio) query.set('convenio', filtros.convenio)
  const texto = query.toString()
  return texto ? `${caminho}?${texto}` : caminho
}

function FiltroChips({
  rotulo,
  opcoes,
  atual,
  hrefDe,
}: {
  rotulo: string
  opcoes: { chave: string; nome: string; valor?: string }[]
  atual?: string
  hrefDe: (valor?: string) => string
}) {
  return (
    <nav
      aria-label={rotulo}
      className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {opcoes.map((o) => {
        const ativo = o.valor === atual
        return (
          <Link
            key={o.chave}
            href={hrefDe(o.valor)}
            aria-current={ativo ? 'true' : undefined}
            className={`${CLASSE_CHIP} ${
              ativo
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-card text-foreground hover:bg-muted'
            }`}
          >
            {o.nome}
          </Link>
        )
      })}
    </nav>
  )
}

export function ListaInternacoes({
  internacoes,
  equipes,
  equipeAtual,
  convenios,
  convenioAtual,
  caminho,
  mostrarStatusHoje,
}: {
  internacoes: LinhaInternacao[]
  equipes: { id: string; nome: string }[]
  equipeAtual?: string
  convenios: string[]
  convenioAtual?: string
  caminho: string
  mostrarStatusHoje: boolean
}) {
  const total = internacoes.length

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <FiltroChips
          rotulo="Filtrar por equipe"
          opcoes={[{ chave: 'todas', nome: 'Todas as equipes' }, ...equipes.map((e) => ({ chave: e.id, nome: e.nome, valor: e.id }))]}
          atual={equipeAtual}
          hrefDe={(equipe) => hrefFiltros(caminho, { equipe, convenio: convenioAtual })}
        />
        <FiltroChips
          rotulo="Filtrar por convênio"
          opcoes={[{ chave: 'todos', nome: 'Todos os convênios' }, ...convenios.map((c) => ({ chave: c, nome: c, valor: c }))]}
          atual={convenioAtual}
          hrefDe={(convenio) => hrefFiltros(caminho, { equipe: equipeAtual, convenio })}
        />
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === 1 ? '1 paciente' : `${total} pacientes`}
      </p>

      {total === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-muted-foreground">
          Nenhum paciente nesta lista.
        </p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:gap-3 xl:grid-cols-[repeat(3,minmax(0,1fr))]">
          {internacoes.map((linha) => (
            <CartaoInternacao
              key={linha.internacao_id}
              linha={linha}
              mostrarStatusHoje={mostrarStatusHoje}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
