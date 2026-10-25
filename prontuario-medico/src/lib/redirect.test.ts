import { describe, expect, it } from 'vitest'
import { destinoSeguro } from './redirect'

describe('destinoSeguro', () => {
  it('mantém caminho interno com query', () => {
    expect(destinoSeguro('/internacoes/1?x=2')).toBe('/internacoes/1?x=2')
  })

  it.each([
    ['protocolo-relativo', '//evil.com'],
    ['barra invertida', '/\\evil.com'],
    ['barra codificada', '/%2F%2Fevil.com'],
    ['barra mista codificada', '/%5C%5Cevil.com'],
    ['URL absoluta', 'https://evil.com'],
    ['tab no meio', '/\t/evil.com'],
    ['CR no meio', '/\r/evil.com'],
    ['javascript', 'javascript:alert(1)'],
    ['nulo', null],
    ['vazio', ''],
  ])('rejeita %s', (_nome, entrada) => {
    expect(destinoSeguro(entrada)).toBe('/')
  })
})
