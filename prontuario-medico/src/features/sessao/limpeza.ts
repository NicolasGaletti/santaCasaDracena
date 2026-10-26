import { del, keys } from 'idb-keyval'

type FilaForcavel = { forcar(): Promise<void> }

const filas = new Set<FilaForcavel>()

/** Filas de autosave ativas, para a saída da sessão enviar o que ainda está pendente. */
export function registrarFila(fila: FilaForcavel): () => void {
  filas.add(fila)
  return () => {
    filas.delete(fila)
  }
}

/** Tenta enviar o pendente de todas as filas; desiste após `timeoutMs` para rede travada não impedir a saída. */
export async function aguardarFilas(timeoutMs: number): Promise<void> {
  if (filas.size === 0) return
  let timer: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs)
  })
  const envios = Promise.allSettled([...filas].map((f) => f.forcar())).then(() => {})
  await Promise.race([envios, limite])
  clearTimeout(timer)
}

/** Apaga as cópias locais de rascunho (IndexedDB, chaves `rascunho:*`). Falha de IndexedDB não impede o logout. */
export async function limparCopiasLocais(): Promise<void> {
  try {
    const todas = await keys()
    await Promise.all(todas.filter((k) => typeof k === 'string' && k.startsWith('rascunho:')).map((k) => del(k)))
  } catch {
    // IndexedDB indisponível: não há cópia a apagar.
  }
}
