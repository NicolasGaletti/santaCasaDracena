import { beforeEach, describe, expect, it, vi } from 'vitest'

const armazem = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  keys: async () => [...armazem.keys()],
  del: async (k: string) => void armazem.delete(k),
}))

import { aguardarFilas, limparCopiasLocais, registrarFila } from './limpeza'

beforeEach(() => armazem.clear())

describe('limparCopiasLocais', () => {
  it('apaga só chaves rascunho:*', async () => {
    armazem.set('rascunho:a:b', 1)
    armazem.set('rascunho:c:d', 2)
    armazem.set('outra', 3)
    await limparCopiasLocais()
    expect([...armazem.keys()]).toEqual(['outra'])
  })
})

describe('aguardarFilas', () => {
  it('chama forcar das filas registradas', async () => {
    const forcar = vi.fn(async () => {})
    const sair = registrarFila({ forcar })
    await aguardarFilas(1000)
    expect(forcar).toHaveBeenCalledTimes(1)
    sair()
    await aguardarFilas(1000)
    expect(forcar).toHaveBeenCalledTimes(1)
  })

  it('desiste após o timeout se forcar travar', async () => {
    registrarFila({ forcar: () => new Promise<void>(() => {}) })
    const t = Date.now()
    await aguardarFilas(50)
    expect(Date.now() - t).toBeLessThan(1000)
  })

  it('ignora fila que rejeita', async () => {
    registrarFila({ forcar: async () => Promise.reject(new Error('x')) })
    await expect(aguardarFilas(100)).resolves.toBeUndefined()
  })
})
