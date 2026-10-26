'use client'

import { useEffect } from 'react'
import { encerrarPorInatividade } from './encerrar'

const CHAVE = 'ultima-atividade'
const GRAVAR_A_CADA_MS = 30_000
const REPETIR_APOS_FALHA_MS = 30_000
const EVENTOS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

function lerCompartilhado(): number {
  try {
    return Number(localStorage.getItem(CHAVE)) || 0
  } catch {
    return 0
  }
}

/**
 * Encerra a sessão após `minutos` sem interação. A última atividade é compartilhada entre abas via
 * localStorage: atividade em qualquer aba mantém as demais vivas.
 */
export function MonitorInatividade({ minutos = 30 }: { minutos?: number }) {
  useEffect(() => {
    const limiteMs = minutos * 60_000
    let ultima = Date.now()
    let ultimaGravacao = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let encerrado = false

    function gravar(agora: number) {
      if (agora - ultimaGravacao < GRAVAR_A_CADA_MS) return
      ultimaGravacao = agora
      try {
        localStorage.setItem(CHAVE, String(agora))
      } catch {
        // Sem localStorage: vale só a atividade desta aba.
      }
    }

    function verificar() {
      if (encerrado) return
      const agora = Date.now()
      // Relógio que andou para trás: timestamp futuro vale como "agora", senão a sessão nunca expira.
      let compartilhado = lerCompartilhado()
      if (compartilhado > agora) {
        // Regrava o valor corrigido, senão ele seguiria "no futuro" e valeria como agora a cada checagem.
        compartilhado = agora
        try {
          localStorage.setItem(CHAVE, String(agora))
        } catch {
          // Sem localStorage: vale só a atividade desta aba.
        }
      }
      const atividade = Math.min(agora, Math.max(ultima, compartilhado))
      const restante = limiteMs - (agora - atividade)
      if (restante <= 0) {
        encerrado = true
        void encerrarPorInatividade().catch(() => {
          encerrado = false
          clearTimeout(timer)
          timer = setTimeout(verificar, REPETIR_APOS_FALHA_MS)
        })
        return
      }
      clearTimeout(timer)
      timer = setTimeout(verificar, restante)
    }

    function aoInteragir() {
      const agora = Date.now()
      ultima = agora
      gravar(agora)
    }

    gravar(ultima)
    EVENTOS.forEach((e) => window.addEventListener(e, aoInteragir, { passive: true }))
    document.addEventListener('visibilitychange', verificar)
    timer = setTimeout(verificar, limiteMs)
    return () => {
      clearTimeout(timer)
      EVENTOS.forEach((e) => window.removeEventListener(e, aoInteragir))
      document.removeEventListener('visibilitychange', verificar)
    }
  }, [minutos])

  return null
}
