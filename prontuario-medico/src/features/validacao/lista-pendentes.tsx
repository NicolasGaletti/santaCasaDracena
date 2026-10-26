import Link from 'next/link'
import { Clock, MapPin, UserRound } from 'lucide-react'
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
      <p className="rounded-xl border border-dashed border-input bg-card p-6 text-center text-muted-foreground">
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
            className="flex min-h-11 flex-col gap-2 rounded-xl border border-l-4 border-border border-l-teal-decorativo bg-card p-4 text-card-foreground transition-colors hover:bg-primary-suave focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0 break-words font-heading font-bold leading-snug">{p.pacienteNome}</span>
              {p.adendoDe && <Badge variant="outline" className="shrink-0">Adendo</Badge>}
            </div>
            <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              <span className="min-w-0 break-words">
                Leito {p.leito || 'não informado'} · {p.equipeNome}
              </span>
            </p>
            <p className="flex min-w-0 flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded bg-muted px-2 py-0.5 text-[12px] text-texto-forte">
                {ROTULO_CATEGORIA[p.categoria] ?? p.categoria}
              </span>
              <span className="flex min-w-0 items-center gap-1">
                <UserRound aria-hidden className="size-3.5 shrink-0" />
                <span className="min-w-0 break-words">{p.autorNome}</span>
              </span>
            </p>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-900">
              <Clock aria-hidden className="size-3.5 shrink-0" />
              Enviada {formatarDataHora(p.enviadaEm)} ({tempoDesde(p.enviadaEm)})
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
