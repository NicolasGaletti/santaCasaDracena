import type { AnexoGaleria } from '@/features/anexos/consultas'
import { agruparAdendos } from './agrupar-adendos'
import { CartaoEvolucao, type EvolucaoTimeline } from './cartao-evolucao'

/** Cartões das evoluções, cada adendo logo abaixo da sua original, recuado. */
export function Timeline({ evolucoes, anexos = [] }: { evolucoes: EvolucaoTimeline[]; anexos?: AnexoGaleria[] }) {
  if (evolucoes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-muted-foreground">
        Nenhuma evolução registrada ainda.
      </p>
    )
  }
  return (
    <ol className="flex min-w-0 flex-col gap-3">
      {agruparAdendos(evolucoes).map(({ item, recuo }) => (
        <li key={item.id} className={recuo ? 'ml-4 min-w-0 border-l-2 border-border pl-3 sm:ml-8' : 'min-w-0'}>
          <CartaoEvolucao evolucao={item} anexosOutros={anexos.filter((a) => a.tipo === 'OUTRO' && a.evolucaoId === item.id)} />
        </li>
      ))}
    </ol>
  )
}
