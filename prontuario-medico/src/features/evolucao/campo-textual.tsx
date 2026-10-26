import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { RotuloCampo } from '@/components/layout/rotulo-campo'
import { Textarea } from '@/components/ui/textarea'

export function CampoTextual({
  id,
  rotulo,
  valor,
  onChange,
  obrigatorio = false,
  linhas = 3,
  icone: Icone,
  corRotulo,
  placeholder,
  children,
}: {
  id: string
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  obrigatorio?: boolean
  linhas?: number
  icone?: LucideIcon
  /** Classe de cor do rótulo (ex.: `text-exame-ecg`). */
  corRotulo?: string
  placeholder?: string
  /** Conteúdo logo abaixo do campo (ex.: anexos). */
  children?: ReactNode
}) {
  return (
    <div className="grid min-w-0 content-start gap-1">
      <RotuloCampo htmlFor={id} className={cn('mb-0', corRotulo)}>
        {Icone && <Icone aria-hidden="true" className="size-3.5 shrink-0" />}
        {rotulo}
        {obrigatorio && <span aria-hidden="true"> *</span>}
      </RotuloCampo>
      <Textarea id={id} rows={linhas} value={valor} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {children}
    </div>
  )
}
