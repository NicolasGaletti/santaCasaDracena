import { describe, expect, it, vi } from 'vitest'
import type { FilaAutosave } from './autosave'
import { enviarEvolucao, MENSAGEM_SEM_CONEXAO_ENVIO } from './envio'

function filaFake(over: Partial<FilaAutosave<unknown>> & { forcar: () => Promise<void> }): FilaAutosave<unknown> {
  return { estado: 'salvo', mensagemErro: undefined, evolucaoId: 'ev-1', ...over } as unknown as FilaAutosave<unknown>
}

describe('enviarEvolucao', () => {
  it('chama a ação com o id depois de salvar a versão mais nova', async () => {
    const ordem: string[] = []
    const fila = filaFake({ forcar: async () => void ordem.push('forcar') })
    const acao = vi.fn(async (id: string) => {
      ordem.push(`acao:${id}`)
      return undefined
    })
    expect(await enviarEvolucao(fila, acao)).toEqual({})
    expect(ordem).toEqual(['forcar', 'acao:ev-1'])
  })

  it('falha ao salvar não chama a ação e devolve a mensagem da fila', async () => {
    const acao = vi.fn()
    const fila = filaFake({ estado: 'erro', mensagemErro: 'Campo inválido', forcar: async () => Promise.reject(new Error('x')) })
    expect(await enviarEvolucao(fila, acao)).toEqual({ erro: 'Campo inválido' })
    expect(acao).not.toHaveBeenCalled()
  })

  it('falha de conexão sem mensagem própria usa a mensagem de conexão', async () => {
    const fila = filaFake({ estado: 'offline', forcar: async () => Promise.reject(new Error('x')) })
    expect(await enviarEvolucao(fila, vi.fn())).toEqual({ erro: MENSAGEM_SEM_CONEXAO_ENVIO })
  })

  it('repassa o erro de negócio da ação', async () => {
    const fila = filaFake({ forcar: async () => {} })
    expect(await enviarEvolucao(fila, async () => ({ erro: 'Há anexo não enviado.' }))).toEqual({ erro: 'Há anexo não enviado.' })
  })
})
