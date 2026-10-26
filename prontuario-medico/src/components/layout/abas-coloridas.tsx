'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from 'cn'

export type CorAba = 'teal' | 'rose' | 'sky' | 'emerald'

export type AbaColorida = { valor: string; rotulo: string; icone: LucideIcon; cor: CorAba }

const INATIVA: Record<CorAba, string> = {
  teal: 'text-slate-600',
  rose: 'text-rose-700',
  sky: 'text-sky-700',
  emerald: 'text-emerald-700',
}

type Props = {
  abas: AbaColorida[]
  valor: string
  onValorChange: (valor: string) => void
  children: ReactNode
}

/** Abas com cor por tipo (Radix Tabs: setas, Home/End e foco de graça). Use `AbaPainel` nos filhos. */
export function AbasColoridas({ abas, valor, onValorChange, children }: Props) {
  return (
    <TabsPrimitive.Root data-slot="abas-coloridas" value={valor} onValueChange={onValorChange} className="flex min-w-0 flex-col gap-4">
      <TabsPrimitive.List className="flex w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none] sm:w-fit [&::-webkit-scrollbar]:hidden">
        {abas.map(({ valor: v, rotulo, icone: Icone, cor }) => (
          <TabsPrimitive.Trigger
            key={v}
            value={v}
            className={cn(
              'inline-flex min-h-11 flex-1 shrink-0 max-sm:[&_svg]:hidden items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold sm:text-sm whitespace-nowrap transition-colors outline-none hover:bg-white/70 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:bg-teal-700 data-[state=active]:text-white data-[state=active]:hover:bg-teal-700 sm:flex-none sm:px-4',
              INATIVA[cor],
            )}
          >
            <Icone aria-hidden className="size-4" />
            {rotulo}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  )
}

export function AbaPainel({ valor, className, children }: { valor: string; className?: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Content value={valor} className={cn('min-w-0 outline-none', className)}>
      {children}
    </TabsPrimitive.Content>
  )
}
