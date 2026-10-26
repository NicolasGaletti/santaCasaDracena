'use client'

import { useId, useRef, type KeyboardEvent } from 'react'
import { cn } from 'cn'

type Props<T extends string> = {
  nome: string
  rotulo: string
  opcoes: { valor: T; rotulo: string }[]
  valor: T
  onChange: (valor: T) => void
  className?: string
}

/** Escolha única em chips: `radiogroup` com seta movendo a seleção (roving tabindex). */
export function ChipsSelecao<T extends string>({ nome, rotulo, opcoes, valor, onChange, className }: Props<T>) {
  const idRotulo = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = opcoes.length
    let alvo: number
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        alvo = (i + 1) % n
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        alvo = (i - 1 + n) % n
        break
      case 'Home':
        alvo = 0
        break
      case 'End':
        alvo = n - 1
        break
      default:
        return
    }
    e.preventDefault()
    onChange(opcoes[alvo].valor)
    refs.current[alvo]?.focus()
  }

  const indiceAtivo = Math.max(0, opcoes.findIndex((o) => o.valor === valor))

  return (
    <div role="radiogroup" aria-label={rotulo} data-nome={nome} id={idRotulo} className={cn('flex flex-wrap gap-2', className)}>
      {opcoes.map((o, i) => {
        const ativo = o.valor === valor
        return (
          <button
            key={o.valor}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={ativo}
            tabIndex={i === indiceAtivo ? 0 : -1}
            onClick={() => onChange(o.valor)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border px-4 text-[13px] font-semibold transition-colors sm:min-h-9',
              ativo
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-card text-texto-forte hover:bg-muted',
            )}
          >
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}
