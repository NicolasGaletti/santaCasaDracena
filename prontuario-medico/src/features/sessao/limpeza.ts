import { del, keys } from 'idb-keyval'

export type FilaRegistravel = {
  /** Chave IndexedDB da cópia local desta fila (`rascunho:<internação>:<usuário>`). */
  chave: string
  forcar(): Promise<void>
  cancelar(): Promise<void>
}

export type ResultadoFilas = { salvas: FilaRegistravel[]; naoSalvas: FilaRegistravel[] }

const filas = new Set<FilaRegistravel>()

/** Filas de autosave ativas, para a saída da sessão enviar o que ainda está pendente. */
export function registrarFila(fila: FilaRegistravel): () => void {
  filas.add(fila)
  return () => {
    filas.delete(fila)
  }
}

/**
 * Tenta enviar o pendente de todas as filas; desiste após `timeoutMs` para rede travada não impedir a saída.
 * Devolve quais filas ficaram sincronizadas e quais não (rejeitaram ou não terminaram a tempo).
 */
export async function aguardarFilas(timeoutMs: number): Promise<ResultadoFilas> {
  const todas = [...filas]
  if (todas.length === 0) return { salvas: [], naoSalvas: [] }
  const ok = new Set<FilaRegistravel>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs)
  })
  const envios = Promise.allSettled(
    todas.map((f) =>
      f.forcar().then(() => {
        ok.add(f)
      }),
    ),
  ).then(() => {})
  await Promise.race([envios, limite])
  clearTimeout(timer)
  return { salvas: todas.filter((f) => ok.has(f)), naoSalvas: todas.filter((f) => !ok.has(f)) }
}

/**
 * Cancela as filas (nenhuma escrita tardia recria chave) e apaga as cópias locais, exceto as das filas
 * não sincronizadas: perder o único exemplar de um rascunho clínico é pior que deixá-lo no aparelho.
 * Devolve true se alguma cópia não sincronizada ficou guardada.
 */
export async function finalizarSaida(r: ResultadoFilas): Promise<boolean> {
  r.naoSalvas.forEach((f) => void f.cancelar().catch(() => {}))
  await Promise.all(r.salvas.map((f) => f.cancelar().catch(() => {})))
  await limparCopiasLocais(r.naoSalvas.map((f) => f.chave))
  return r.naoSalvas.length > 0
}

/** Apaga as cópias locais de rascunho (IndexedDB, chaves `rascunho:*`), exceto `manter`. Falha de IndexedDB não impede o logout. */
export async function limparCopiasLocais(manter: readonly string[] = []): Promise<void> {
  try {
    const todas = await keys()
    await Promise.all(
      todas
        .filter((k) => typeof k === 'string' && k.startsWith('rascunho:') && !manter.includes(k))
        .map((k) => del(k)),
    )
  } catch {
    // IndexedDB indisponível: não há cópia a apagar.
  }
}
