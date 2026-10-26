'use client'

import { sair, sairPorInatividade } from '@/app/login/actions'
import { bloquearTela, desbloquearTela } from './bloqueio'
import { aguardarFilas, finalizarSaida, reabrirFilas, type ResultadoFilas } from './limpeza'

const ESPERA_FILAS_MS = 5000

/** Tenta enviar o rascunho pendente (com limite de tempo). Ainda não cancela nem apaga nada. */
export function sincronizarAntesDeSair(): Promise<ResultadoFilas> {
  return aguardarFilas(ESPERA_FILAS_MS)
}

/**
 * Bloqueia a tela, envia o pendente, cancela as filas, apaga só as cópias marcadas como sincronizadas e sai.
 * Se a saída falhar, desbloqueia e reabre as filas (nada digitado depois se perde).
 */
async function sairBloqueando(sairDaSessao: (pendente: boolean) => Promise<void>): Promise<void> {
  bloquearTela()
  try {
    await sincronizarAntesDeSair()
    const pendente = await finalizarSaida()
    await sairDaSessao(pendente)
  } catch (erro) {
    reabrirFilas()
    desbloquearTela()
    throw erro
  }
}

export function sairLimpando(): Promise<void> {
  return sairBloqueando(sair)
}

export function encerrarPorInatividade(): Promise<void> {
  return sairBloqueando(sairPorInatividade)
}
