import { describe, expect, it } from 'vitest'
import { dataValida, lerFiltros, limitesPeriodo, queryAuditoria, resumoDiff } from './funcoes'

describe('auditoria: funções', () => {
  it('valida datas e ignora as inválidas', () => {
    expect(dataValida('2026-10-25')).toBe('2026-10-25')
    expect(dataValida('2026-02-30')).toBeUndefined()
    expect(dataValida('abc')).toBeUndefined()
    expect(dataValida(undefined)).toBeUndefined()
  })

  it('lê filtros com valores inválidos descartados', () => {
    const f = lerFiltros({ aba: 'x', de: '2026-13-01', ate: '2026-10-02', profissional: 'nao-uuid', pagina: '-3' })
    expect(f).toEqual({ aba: 'acessos', de: undefined, ate: '2026-10-02', profissional: undefined, pagina: 1 })
    expect(lerFiltros({ aba: 'alteracoes', pagina: '3' }).pagina).toBe(3)
  })

  it('período em horário de São Paulo, fim exclusivo no dia seguinte', () => {
    expect(limitesPeriodo('2026-10-01', '2026-10-31')).toEqual({
      inicio: '2026-10-01T00:00:00-03:00',
      fim: '2026-11-01T00:00:00-03:00',
    })
    expect(limitesPeriodo()).toEqual({ inicio: undefined, fim: undefined })
  })

  it('resume o diff só com nomes de colunas', () => {
    expect(resumoDiff('INSERT', null, { a: 1 })).toBe('criado')
    expect(resumoDiff('DELETE', { a: 1 }, null)).toBe('removido')
    expect(resumoDiff('UPDATE', { b: 1, a: 'x', c: 2 }, { b: 1, a: 'y', c: 3 })).toBe('a, c')
    expect(resumoDiff('UPDATE', { a: 1 }, { a: 1 })).toBe('sem mudança de valores')
  })

  it('monta a query preservando filtros', () => {
    expect(queryAuditoria({ aba: 'acessos' })).toBe('/auditoria')
    expect(queryAuditoria({ aba: 'alteracoes', de: '2026-10-01', pagina: 2 })).toBe('/auditoria?aba=alteracoes&de=2026-10-01&pagina=2')
  })
})
