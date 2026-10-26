import { describe, expect, it } from 'vitest'
import { statusDoDia, type EntradaStatusDia } from './status-dia'

const base: EntradaStatusDia = {
  internacaoAlta: false,
  rascunhoProprio: false,
  devolvidaParaMim: false,
  aguardandoProprio: false,
  finalizadaHoje: false,
}

describe('statusDoDia', () => {
  it('sem nada: sem evolução hoje', () => {
    expect(statusDoDia(base)).toEqual({ tipo: 'nenhuma', texto: 'Sem evolução hoje' })
  })
  it('rascunho próprio', () => {
    expect(statusDoDia({ ...base, rascunhoProprio: true })).toEqual({ tipo: 'rascunho', texto: 'Rascunho de hoje' })
  })
  it('rascunho próprio vence finalizada hoje', () => {
    expect(statusDoDia({ ...base, rascunhoProprio: true, finalizadaHoje: true }).tipo).toBe('rascunho')
  })
  it('aguardando validação', () => {
    expect(statusDoDia({ ...base, aguardandoProprio: true })).toEqual({ tipo: 'aguardando', texto: 'Aguardando validação' })
  })
  it('devolvida para mim', () => {
    expect(statusDoDia({ ...base, rascunhoProprio: true, devolvidaParaMim: true })).toEqual({ tipo: 'devolvida', texto: 'Devolvida' })
  })
  it('alta vence finalizada', () => {
    expect(statusDoDia({ ...base, internacaoAlta: true, finalizadaHoje: true })).toEqual({ tipo: 'alta', texto: 'Alta' })
  })
  it('finalizada hoje por qualquer um', () => {
    expect(statusDoDia({ ...base, finalizadaHoje: true })).toEqual({ tipo: 'finalizada', texto: 'Evoluído hoje' })
  })
})
