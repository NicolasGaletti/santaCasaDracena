'use client'

import { FlaskConical, HeartPulse, History, List, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { AbaPainel, AbasColoridas, type AbaColorida } from '@/components/layout/abas-coloridas'
import { CartaoSecao } from '@/components/layout/cartao-secao'
import type { AnexoGaleria } from '@/features/anexos/consultas'
import { GaleriaExames } from '@/features/anexos/galeria-exames'
import { ROTULO_TIPO_ANEXO, type TipoAnexo } from '@/features/anexos/rotulos'
import { CartaoEvolucao, lerDadosMedica, temSecao, type EvolucaoTimeline, type SecaoExame } from './cartao-evolucao'
import { Timeline } from './timeline'

const ABAS: AbaColorida[] = [
  { valor: 'evolucoes', rotulo: 'Evoluções', icone: List, cor: 'teal' },
  { valor: 'ecg', rotulo: 'ECG', icone: HeartPulse, cor: 'rose' },
  { valor: 'imagem', rotulo: 'Imagem', icone: ScanLine, cor: 'sky' },
  { valor: 'laboratorio', rotulo: 'Laboratório', icone: FlaskConical, cor: 'emerald' },
]

const DE_EXAME: { valor: string; secao: SecaoExame; tipo: TipoAnexo }[] = [
  { valor: 'ecg', secao: 'ecg', tipo: 'ECG' },
  { valor: 'imagem', secao: 'exames_imagem', tipo: 'IMAGEM' },
  { valor: 'laboratorio', secao: 'exames_laboratoriais', tipo: 'LABORATORIO' },
]

/** Histórico da internação: evoluções finalizadas e, por abas, o texto e os anexos de ECG, imagem e laboratório. */
export function HistoricoAbas({ evolucoes, anexos }: { evolucoes: EvolucaoTimeline[]; anexos: AnexoGaleria[] }) {
  const [aba, setAba] = useState('evolucoes')

  return (
    <CartaoSecao titulo="Histórico da internação" icone={History}>
      <AbasColoridas abas={ABAS} valor={aba} onValorChange={setAba}>
        <AbaPainel valor="evolucoes">
          <Timeline evolucoes={evolucoes} anexos={anexos} />
        </AbaPainel>
        {DE_EXAME.map(({ valor, secao, tipo }) => {
          const comTexto = evolucoes.filter((e) => temSecao(lerDadosMedica(e.dados), secao))
          return (
            <AbaPainel key={valor} valor={valor} className="grid gap-4">
              {comTexto.length === 0 && !anexos.some((a) => a.tipo === tipo) && (
                <p className="rounded-lg border border-dashed border-border p-4 text-muted-foreground">
                  Nenhum registro de {ROTULO_TIPO_ANEXO[tipo]} nas evoluções finalizadas.
                </p>
              )}
              {comTexto.length > 0 && (
                <ol className="flex min-w-0 flex-col gap-3">
                  {comTexto.map((e) => (
                    <li key={e.id} className="min-w-0">
                      <CartaoEvolucao evolucao={e} secao={secao} ocultarAcoes />
                    </li>
                  ))}
                </ol>
              )}
              {anexos.some((a) => a.tipo === tipo) && <GaleriaExames anexos={anexos} tipo={tipo} />}
            </AbaPainel>
          )
        })}
      </AbasColoridas>
    </CartaoSecao>
  )
}
