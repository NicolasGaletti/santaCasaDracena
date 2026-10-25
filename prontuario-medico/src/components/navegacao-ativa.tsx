'use client'

import { useEffect, useSyncExternalStore } from 'react'

/**
 * Aba de navegação marcada pela página de conteúdo (ex.: prontuário de uma internação
 * INTERNADO marca "Internados"; ALTA marca "Anteriores"). Sem valor, vale a rota.
 */
export type AbaNavegacao = 'internados' | 'anteriores'

let abaAtual: AbaNavegacao | null = null
const ouvintes = new Set<() => void>()

function definir(aba: AbaNavegacao | null) {
  abaAtual = aba
  ouvintes.forEach((cb) => cb())
}

function assinar(cb: () => void) {
  ouvintes.add(cb)
  return () => {
    ouvintes.delete(cb)
  }
}

export function useAbaAtiva(): AbaNavegacao | null {
  return useSyncExternalStore(
    assinar,
    () => abaAtual,
    () => null,
  )
}

export function MarcarAba({ status }: { status: 'INTERNADO' | 'ALTA' }) {
  useEffect(() => {
    definir(status === 'INTERNADO' ? 'internados' : 'anteriores')
    return () => definir(null)
  }, [status])
  return null
}
