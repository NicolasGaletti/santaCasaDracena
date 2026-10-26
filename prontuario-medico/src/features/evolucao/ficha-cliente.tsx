'use client'

import { useState } from 'react'
import type { AnexoRascunho } from '@/features/anexos/enviar-anexo'
import type { EvolucaoTimeline } from './cartao-evolucao'
import { FormMedica } from './form-medica'
import { FormSimples } from './form-simples'
import type { DadosMedica } from './modelos/medica'
import type { DadosSimples } from './modelos/simples'

type Rascunho<D> = { id: string; dados: D; textoLivre: string; devolvidaMotivo: string | null; devolvidaPorNome?: string | null }

type Comum = { internacaoId: string; userId: string; anexos: AnexoRascunho[]; adendo: EvolucaoTimeline | null }

type Props =
  | (Comum & { tipo: 'medica'; perfil: string; rascunho: Rascunho<DadosMedica> | null; anterior: DadosMedica | null })
  | (Comum & { tipo: 'simples'; categoria: string; rascunho: Rascunho<DadosSimples> | null })

/**
 * Ficha de evolução montada no prontuário. `ciclo` muda quando uma evolução própria é concluída (finalizada ou
 * enviada) e o descarte reinicia a ficha na hora; em ambos os casos o formulário recomeça sem estado antigo.
 */
export function FichaCliente({ ciclo, ...props }: Props & { ciclo: string }) {
  const [reinicio, setReinicio] = useState(0)
  const [descartado, setDescartado] = useState<string | null>(null)
  const velho = props.rascunho !== null && props.rascunho.id === descartado
  const chave = `${props.internacaoId}:${ciclo}:${reinicio}`
  const comum = { internacaoId: props.internacaoId, userId: props.userId, anexos: velho ? [] : props.anexos, adendo: velho ? null : props.adendo }
  const aoDescartar = (id: string) => {
    setDescartado(id)
    setReinicio((n) => n + 1)
  }

  if (props.tipo === 'simples') {
    return <FormSimples key={chave} {...comum} categoria={props.categoria} rascunho={velho ? null : props.rascunho} aoDescartar={aoDescartar} />
  }
  return (
    <FormMedica
      key={chave}
      {...comum}
      perfil={props.perfil}
      rascunho={velho ? null : props.rascunho}
      anterior={props.anterior}
      aoDescartar={aoDescartar}
    />
  )
}
