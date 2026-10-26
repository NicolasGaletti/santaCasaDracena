import { beforeEach, describe, expect, it, vi } from 'vitest'

const armazem = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  keys: async () => [...armazem.keys()],
  get: async (k: string) => armazem.get(k),
  del: async (k: string) => void armazem.delete(k),
}))

import { aguardarFilas, finalizarSaida, haCopiaNaoSincronizada, limparCopiasLocais, registrarFila } from './limpeza'

beforeEach(() => armazem.clear())

function fila(chave: string, forcar: () => Promise<void> = async () => {}) {
  return { chave, forcar: vi.fn(forcar), cancelar: vi.fn(async () => {}), reabrir: vi.fn() }
}

describe('limparCopiasLocais', () => {
  it('apaga só cópias marcadas sincronizadas, em chaves rascunho:*', async () => {
    armazem.set('rascunho:a:b', { sincronizado: true })
    armazem.set('rascunho:c:d', { sincronizado: true })
    armazem.set('outra', { sincronizado: true })
    await limparCopiasLocais()
    expect([...armazem.keys()]).toEqual(['outra'])
  })

  it('registro sem marcador (formato antigo) é mantido', async () => {
    armazem.set('rascunho:antigo:u', { dados: {}, textoLivre: 'x' })
    armazem.set('rascunho:nulo:u', undefined)
    await limparCopiasLocais()
    expect([...armazem.keys()].sort()).toEqual(['rascunho:antigo:u', 'rascunho:nulo:u'])
  })

  it('cópia não sincronizada de outra internação/aba/fila desmontada é mantida', async () => {
    armazem.set('rascunho:outra-aba:u', { sincronizado: false })
    armazem.set('rascunho:desmontada:u', { sincronizado: false })
    armazem.set('rascunho:ok:u', { sincronizado: true })
    await limparCopiasLocais()
    expect([...armazem.keys()].sort()).toEqual(['rascunho:desmontada:u', 'rascunho:outra-aba:u'])
  })

  it('escrita depois do forcar (marcador false) sobrevive à limpeza', async () => {
    armazem.set('rascunho:i:u', { sincronizado: true })
    // digitação entre forcar() e a limpeza regrava com marcador false
    armazem.set('rascunho:i:u', { sincronizado: false, textoLivre: 'novo' })
    await limparCopiasLocais()
    expect(armazem.get('rascunho:i:u')).toEqual({ sincronizado: false, textoLivre: 'novo' })
  })
})

describe('haCopiaNaoSincronizada', () => {
  it('detecta cópia sem marcador ou false; ignora sincronizadas', async () => {
    armazem.set('rascunho:a:u', { sincronizado: true })
    expect(await haCopiaNaoSincronizada()).toBe(false)
    armazem.set('rascunho:b:u', { sincronizado: false })
    expect(await haCopiaNaoSincronizada()).toBe(true)
    armazem.set('rascunho:b:u', {})
    expect(await haCopiaNaoSincronizada()).toBe(true)
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
  it('cancela as filas registradas, mantém não sincronizadas e avisa que ficou pendente', async () => {
    armazem.set('rascunho:ok:u', { sincronizado: true })
    armazem.set('rascunho:ruim:u', { sincronizado: false })
    const ok = fila('rascunho:ok:u')
    const ruim = fila('rascunho:ruim:u')
    const s1 = registrarFila(ok)
    const s2 = registrarFila(ruim)
    expect(await finalizarSaida()).toBe(true)
    expect(ok.cancelar).toHaveBeenCalled()
    expect(ruim.cancelar).toHaveBeenCalled()
    expect([...armazem.keys()]).toEqual(['rascunho:ruim:u'])
    s1()
    s2()
  })

  it('pendente vem do que sobrou no IndexedDB (fila não registrada)', async () => {
    armazem.set('rascunho:sem-fila:u', { sincronizado: false })
    expect(await finalizarSaida()).toBe(true)
  })

  it('sem pendências apaga tudo e devolve false', async () => {
    armazem.set('rascunho:ok:u', { sincronizado: true })
    expect(await finalizarSaida()).toBe(false)
    expect([...armazem.keys()]).toEqual([])
  })
})
