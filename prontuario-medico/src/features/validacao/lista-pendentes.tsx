import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ROTULO_CATEGORIA } from '@/features/evolucao/rotulos'
import { formatarDataHora } from '@/features/evolucao/cartao-evolucao'
import type { PendenteValidacao } from './consultas'

/** Há quanto tempo a evolução foi enviada, em texto corrido ("há 2 horas"). */
export function tempoDesde(iso: string, agora: Date = new Date()): string {
  const minutos = Math.max(0, Math.floor((agora.getTime() - new Date(iso).getTime()) / 60_000))
  if (minutos < 1) return 'há menos de 1 minuto'
  if (minutos < 60) return `há ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(horas / 24)
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

export function ListaPendentes({ pendentes }: { pendentes: PendenteValidacao[] }) {
  if (pendentes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-muted-foreground">
        Nenhuma evolução aguardando validação.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {pendentes.map((p) => (
        <li key={p.id}>
          <Link
            href={`/validacao?evolucao=${p.id}`}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0 break-words font-bold leading-snug">{p.pacienteNome}</span>
              {p.adendoDe && <Badge variant="outline" className="shrink-0">Adendo</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Leito {p.leito || 'não informado'} · {p.equipeNome}
            </p>
            <p className="text-sm">
              {ROTULO_CATEGORIA[p.categoria] ?? p.categoria} · {p.autorNome}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              Enviada {formatarDataHora(p.enviadaEm)} ({tempoDesde(p.enviadaEm)})
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
