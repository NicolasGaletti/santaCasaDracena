import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from 'cn'

type Props = {
  titulo: string
  icone?: LucideIcon
  subtitulo?: string
  acao?: ReactNode
  rodape?: ReactNode
  tom?: 'padrao' | 'teal'
  className?: string
  children: ReactNode
}

/** Cartão branco de seção: título Poppins com ícone, subtítulo, ação e rodapé opcionais. */
export function CartaoSecao({ titulo, icone: Icone, subtitulo, acao, rodape, tom = 'padrao', className, children }: Props) {
  return (
    <section
      data-slot="cartao-secao"
      className={cn(
        'min-w-0 rounded-xl border bg-card',
        tom === 'teal' ? 'border-primary-suave-borda' : 'border-border',
        className,
      )}
    >
      <header
        className={cn(
          'flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4',
          tom === 'teal' ? 'border-primary-suave-borda bg-primary-suave' : 'border-border',
        )}
      >
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-heading font-bold text-primary-suave-foreground">
            {Icone && <Icone aria-hidden className="size-5 shrink-0" />}
            <span className="min-w-0 break-words">{titulo}</span>
          </h2>
          {subtitulo && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitulo}</p>}
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
      {rodape && <footer className="rounded-b-xl border-t border-border bg-muted px-4 py-3 sm:px-5">{rodape}</footer>}
    </section>
  )
}
