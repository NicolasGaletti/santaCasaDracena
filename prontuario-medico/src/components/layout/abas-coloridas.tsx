'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from 'cn'

export type CorAba = 'teal' | 'rose' | 'sky' | 'emerald'

export type AbaColorida = { valor: string; rotulo: string; icone: LucideIcon; cor: CorAba }

const ATIVA: Record<CorAba, string> = {
  teal: 'data-[state=active]:border-teal-700 data-[state=active]:text-primary-suave-foreground',
  rose: 'data-[state=active]:border-exame-ecg data-[state=active]:text-exame-ecg',
  sky: 'data-[state=active]:border-exame-imagem data-[state=active]:text-exame-imagem',
  emerald: 'data-[state=active]:border-exame-lab data-[state=active]:text-exame-lab',
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
      <TabsPrimitive.List className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {abas.map(({ valor: v, rotulo, icone: Icone, cor }) => (
          <TabsPrimitive.Trigger
            key={v}
            value={v}
            className={cn(
              '-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:px-4',
              ATIVA[cor],
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
