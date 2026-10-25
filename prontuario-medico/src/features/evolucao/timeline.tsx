'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { agruparAdendos } from './agrupar-adendos'
import { CartaoEvolucao, lerDadosMedica, temSecao, type EvolucaoTimeline, type SecaoExame } from './cartao-evolucao'

type Filtro = 'todas' | SecaoExame

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'ecg', rotulo: 'ECG' },
  { valor: 'exames_imagem', rotulo: 'Imagem' },
  { valor: 'exames_laboratoriais', rotulo: 'Laboratório' },
]

export function Timeline({ evolucoes }: { evolucoes: EvolucaoTimeline[] }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')

  // Adendos ficam logo abaixo da original, recuados; com filtro, cada item passa pelo próprio conteúdo.
  const visiveis = agruparAdendos(evolucoes, (e) => filtro === 'todas' || temSecao(lerDadosMedica(e.dados), filtro)).map(
    ({ item, recuo }) => ({ evolucao: item, secao: filtro === 'todas' ? undefined : filtro, recuo }),
  )

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Filtrar evoluções por tipo"
        className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {FILTROS.map((f) => {
          const ativo = f.valor === filtro
          return (
            <Button
              key={f.valor}
              type="button"
              size="lg"
              variant={ativo ? 'default' : 'outline'}
              aria-pressed={ativo}
              onClick={() => setFiltro(f.valor)}
              className="min-h-11 shrink-0 snap-start whitespace-nowrap"
            >
              {f.rotulo}
            </Button>
          )
        })}
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-muted-foreground">
          {evolucoes.length === 0
            ? 'Nenhuma evolução registrada ainda.'
            : 'Nenhuma evolução com este tipo de registro.'}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {visiveis.map(({ evolucao, secao, recuo }) => (
            <li key={evolucao.id} className={recuo ? 'ml-4 border-l-2 border-border pl-3 sm:ml-8' : undefined}>
              <CartaoEvolucao evolucao={evolucao} secao={secao} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
