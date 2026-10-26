import type { ComponentProps } from 'react'
import { cn } from 'cn'

/** Rótulo de campo: 11px, negrito, caixa alta, associado ao campo por `htmlFor`. */
export function RotuloCampo({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      data-slot="rotulo-campo"
      className={cn('mb-1 flex items-center gap-1 text-[11px] font-bold tracking-wide text-texto-forte uppercase', className)}
      {...props}
    />
  )
}
