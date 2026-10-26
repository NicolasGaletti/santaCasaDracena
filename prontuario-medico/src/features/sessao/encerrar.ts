'use client'

import { sair, sairPorInatividade } from '@/app/login/actions'
import { aguardarFilas, finalizarSaida, type ResultadoFilas } from './limpeza'

const ESPERA_FILAS_MS = 5000

/** Tenta enviar o rascunho pendente (com limite de tempo). Ainda não cancela nem apaga nada. */
export function sincronizarAntesDeSair(): Promise<ResultadoFilas> {
  return aguardarFilas(ESPERA_FILAS_MS)
}

/** Sai da sessão apagando só as cópias locais já sincronizadas; as demais ficam no aparelho. */
export async function sairLimpando(r: ResultadoFilas): Promise<void> {
  const pendente = await finalizarSaida(r)
  await sair(pendente)
}

export async function encerrarPorInatividade(): Promise<void> {
  const pendente = await finalizarSaida(await sincronizarAntesDeSair())
  await sairPorInatividade(pendente)
}
