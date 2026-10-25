import Link from 'next/link'
import { CartaoInternacao } from './cartao-internacao'
import type { LinhaInternacao } from './consultas'

export function ListaInternacoes({
  internacoes,
  equipes,
  equipeAtual,
  caminho,
  mostrarStatusHoje,
}: {
  internacoes: LinhaInternacao[]
  equipes: { id: string; nome: string }[]
  equipeAtual?: string
  caminho: string
  mostrarStatusHoje: boolean
}) {
  const total = internacoes.length
  const hrefEquipe = (id?: string) => (id ? `${caminho}?equipe=${id}` : caminho)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <nav
        aria-label="Filtrar por equipe"
        className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {[{ id: undefined, nome: 'Todas as equipes' }, ...equipes].map((e) => {
          const ativo = e.id === equipeAtual
          return (
            <Link
              key={e.id ?? 'todas'}
              href={hrefEquipe(e.id)}
              aria-current={ativo ? 'true' : undefined}
              className={`inline-flex min-h-11 shrink-0 snap-start items-center whitespace-nowrap rounded-md border px-4 text-sm font-semibold transition-colors ${
                ativo
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-foreground hover:bg-muted'
              }`}
            >
              {e.nome}
            </Link>
          )
        })}
      </nav>

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
