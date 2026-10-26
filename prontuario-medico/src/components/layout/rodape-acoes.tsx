import type { ReactNode } from 'react'

/**
 * Rodapé de ações: fixo no celular (abaixo de `sm`), estático no computador.
 * No celular o contêiner reserva o espaço inferior para o conteúdo não ficar atrás dele.
 */
export function RodapeAcoes({ children, info }: { children: ReactNode; info?: ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-[calc(5rem+env(safe-area-inset-bottom))] sm:hidden" />
      <div
        data-slot="rodape-acoes"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(15,23,42,0.08)] sm:static sm:z-auto sm:rounded-b-xl sm:bg-muted sm:px-5 sm:pb-3 sm:shadow-none"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-between">
          {info && <div className="min-w-0 text-[13px] text-muted-foreground sm:flex-1">{info}</div>}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:justify-end [&>*]:flex-1 sm:[&>*]:flex-none">{children}</div>
        </div>
      </div>
    </>
  )
}
