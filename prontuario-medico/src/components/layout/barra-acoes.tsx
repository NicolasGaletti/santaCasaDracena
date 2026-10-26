import type { ReactNode } from 'react'
import { cn } from 'cn'

const TIPOS = {
  rascunho: 'border-status-rascunho-borda bg-status-rascunho-bg text-status-rascunho-fg',
  aguardando: 'border-primary-suave-borda bg-primary-suave text-primary-suave-foreground',
  finalizada: 'border-transparent bg-status-feito-bg text-status-feito-fg',
  alta: 'border-destructive-soft-borda bg-destructive-soft text-destructive-soft-foreground',
  devolvida: 'border-destructive-soft-borda bg-destructive-soft text-destructive-soft-foreground',
} as const

export type TipoStatus = keyof typeof TIPOS

/** Pílula de status; o texto sempre acompanha a cor. */
export function PilulaStatus({ tipo, children }: { tipo: TipoStatus; children: ReactNode }) {
  return (
    <span
      data-slot="pilula-status"
      data-tipo={tipo}
      className={cn(
        'inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold whitespace-nowrap [&_svg]:size-4',
        TIPOS[tipo],
      )}
    >
      {children}
    </span>
  )
}

/** Linha compacta: status à esquerda, ações à direita. No celular rola na horizontal, sem barra. */
export function BarraAcoes({ status, children }: { status?: ReactNode; children?: ReactNode }) {
  return (
    <div
      data-slot="barra-acoes"
      className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 sm:px-4 sm:py-3"
    >
      {status && <div className="shrink-0">{status}</div>}
      <div className="-my-1 flex min-w-0 flex-1 snap-x items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] sm:ml-auto sm:justify-end [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
        {children}
      </div>
    </div>
  )
}
