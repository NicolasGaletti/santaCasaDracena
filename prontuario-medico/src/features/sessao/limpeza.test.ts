import { beforeEach, describe, expect, it, vi } from 'vitest'

const armazem = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  keys: async () => [...armazem.keys()],
  del: async (k: string) => void armazem.delete(k),
}))

import { aguardarFilas, finalizarSaida, limparCopiasLocais, registrarFila } from './limpeza'

beforeEach(() => armazem.clear())

function fila(chave: string, forcar: () => Promise<void> = async () => {}) {
  return { chave, forcar: vi.fn(forcar), cancelar: vi.fn(async () => {}) }
}

describe('limparCopiasLocais', () => {
  it('apaga só chaves rascunho:*', async () => {
    armazem.set('rascunho:a:b', 1)
    armazem.set('rascunho:c:d', 2)
    armazem.set('outra', 3)
    await limparCopiasLocais()
    expect([...armazem.keys()]).toEqual(['outra'])
  })

  it('mantém as chaves de filas não sincronizadas', async () => {
    armazem.set('rascunho:a:b', 1)
    armazem.set('rascunho:c:d', 2)
    await limparCopiasLocais(['rascunho:c:d'])
    expect([...armazem.keys()]).toEqual(['rascunho:c:d'])
  })
})

describe('aguardarFilas', () => {
  it('chama forcar das filas registradas e as devolve como salvas', async () => {
    const f = fila('rascunho:1:u')
    const sair = registrarFila(f)
    const r = await aguardarFilas(1000)
    expect(f.forcar).toHaveBeenCalledTimes(1)
    expect(r.salvas).toEqual([f])
    expect(r.naoSalvas).toEqual([])
    sair()
    await aguardarFilas(1000)
    expect(f.forcar).toHaveBeenCalledTimes(1)
  })

  it('fila que trava até o timeout fica como não salva', async () => {
    const f = fila('rascunho:2:u', () => new Promise<void>(() => {}))
    const sair = registrarFila(f)
    const t = Date.now()
    const r = await aguardarFilas(50)
    expect(Date.now() - t).toBeLessThan(1000)
    expect(r.naoSalvas).toEqual([f])
    sair()
  })

  it('fila que rejeita fica como não salva e as outras seguem salvas', async () => {
    const ruim = fila('rascunho:3:u', async () => Promise.reject(new Error('x')))
    const boa = fila('rascunho:4:u')
    const s1 = registrarFila(ruim)
    const s2 = registrarFila(boa)
    const r = await aguardarFilas(100)
    expect(r.naoSalvas).toEqual([ruim])
    expect(r.salvas).toEqual([boa])
    s1()
    s2()
  })
})

describe('finalizarSaida', () => {
  it('cancela as filas, mantém chaves não salvas e avisa que ficou pendente', async () => {
    armazem.set('rascunho:ok:u', 1)
    armazem.set('rascunho:ruim:u', 2)
    const ok = fila('rascunho:ok:u')
    const ruim = fila('rascunho:ruim:u')
    const pendente = await finalizarSaida({ salvas: [ok], naoSalvas: [ruim] })
    expect(pendente).toBe(true)
    expect(ok.cancelar).toHaveBeenCalled()
    expect(ruim.cancelar).toHaveBeenCalled()
    expect([...armazem.keys()]).toEqual(['rascunho:ruim:u'])
  })

  it('sem pendências apaga tudo e devolve false', async () => {
    armazem.set('rascunho:ok:u', 1)
    const pendente = await finalizarSaida({ salvas: [fila('rascunho:ok:u')], naoSalvas: [] })
    expect(pendente).toBe(false)
    expect([...armazem.keys()]).toEqual([])
  })
})
