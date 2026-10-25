import { CartaoEvolucao, type EvolucaoTimeline } from './cartao-evolucao'

/** Original do adendo, somente leitura e recolhível, acima do formulário. */
export function OriginalAdendo({ original }: { original: EvolucaoTimeline }) {
  return (
    <details className="group rounded-lg border border-border bg-muted/40">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 font-semibold">
        Ver evolução original
        <span aria-hidden className="text-muted-foreground group-open:rotate-180">▾</span>
      </summary>
      <div className="p-3 pt-0">
        <CartaoEvolucao evolucao={original} ocultarAcoes />
      </div>
    </details>
  )
}
