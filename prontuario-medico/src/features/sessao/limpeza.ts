import { get, keys } from 'idb-keyval'
import { apagarSeSincronizada } from '@/features/evolucao/autosave'

export type FilaRegistravel = {
  /** Chave IndexedDB da cópia local desta fila (`rascunho:<internação>:<usuário>`). */
  chave: string
  forcar(): Promise<void>
  cancelar(): Promise<void>
  reabrir(): void
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

/** Cancela as filas registradas (nenhuma escrita tardia recria chave). Não espera filas travadas na rede. */
export async function cancelarFilas(): Promise<void> {
  const todas = [...filas]
  const esperar = todas.map((f) => f.cancelar().catch(() => {}))
  await Promise.race([Promise.all(esperar), new Promise<void>((r) => setTimeout(r, 2000))])
}

/** Devolve as filas ao normal quando a saída falhou: o usuário volta a editar e o autosave a enviar. */
export function reabrirFilas(): void {
  filas.forEach((f) => f.reabrir())
}

/** Chaves `rascunho:*` cuja cópia NÃO está marcada como sincronizada (registro sem marcador conta como não sincronizado). */
async function chavesRascunho(): Promise<string[]> {
  const todas = await keys()
  return todas.filter((k): k is string => typeof k === 'string' && k.startsWith('rascunho:'))
}

function sincronizada(registro: unknown): boolean {
  return typeof registro === 'object' && registro !== null && (registro as { sincronizado?: unknown }).sincronizado === true
}

/** Há cópia local (de qualquer aba ou fila) ainda não confirmada pelo servidor? Em dúvida (erro de IndexedDB), responde false. */
export async function haCopiaNaoSincronizada(): Promise<boolean> {
  try {
    for (const k of await chavesRascunho()) {
      if (!sincronizada(await get(k))) return true
    }
  } catch {
    // IndexedDB indisponível: não há cópia a preservar.
  }
  return false
}

/**
 * Fecha a saída: cancela as filas, apaga as cópias já sincronizadas e devolve true se sobrou alguma
 * cópia (não sincronizada) neste aparelho. A decisão é por chave, na hora de apagar.
 */
export async function finalizarSaida(): Promise<boolean> {
  await cancelarFilas()
  await limparCopiasLocais()
  return haCopiaNaoSincronizada()
}

/**
 * Apaga as cópias locais de rascunho (IndexedDB, `rascunho:*`) que o servidor já confirmou. Cópias sem
 * marcador ou não sincronizadas (inclusive de outras abas e filas desmontadas) ficam: perder o único
 * exemplar de um rascunho clínico é pior que deixá-lo no aparelho. Falha de IndexedDB não impede o logout.
 */
export async function limparCopiasLocais(): Promise<void> {
  try {
    for (const k of await chavesRascunho()) {
      await apagarSeSincronizada(k)
    }
  } catch {
    // IndexedDB indisponível: não há cópia a apagar.
  }
}
