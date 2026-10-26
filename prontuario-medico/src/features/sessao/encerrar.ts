'use client'

import { sair, sairPorInatividade } from '@/app/login/actions'
import { aguardarFilas, limparCopiasLocais } from './limpeza'

const ESPERA_FILAS_MS = 5000

/** Envia o rascunho pendente (com limite de tempo) e apaga as cópias locais. */
export async function prepararSaida(): Promise<void> {
  await aguardarFilas(ESPERA_FILAS_MS)
  await limparCopiasLocais()
}

export async function sairLimpando(): Promise<void> {
  await prepararSaida()
  await sair()
}

export async function encerrarPorInatividade(): Promise<void> {
  await prepararSaida()
  await sairPorInatividade()
}
