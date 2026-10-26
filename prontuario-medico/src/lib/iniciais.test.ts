import { describe, expect, it } from 'vitest'
import { iniciais } from './iniciais'

describe('iniciais', () => {
  it('ignora título e parte entre parênteses', () => {
    expect(iniciais('Dra. Marina Lopes (teste)')).toBe('ML')
  })
  it('usa primeiro e último nome', () => {
    expect(iniciais('Maria Silva Santos')).toBe('MS')
  })
  it('ignora Dr., Sr. e Sra.', () => {
    expect(iniciais('Dr. João Souza')).toBe('JS')
    expect(iniciais('Sr. Pedro Alves')).toBe('PA')
    expect(iniciais('Sra. Ana Costa')).toBe('AC')
  })
  it('uma palavra: duas primeiras letras', () => {
    expect(iniciais('madonna')).toBe('MA')
  })
  it('ignora partes sem letra', () => {
    expect(iniciais('Ana - 3 Lima')).toBe('AL')
  })
  it('vazio vira ?', () => {
    expect(iniciais('   ')).toBe('?')
  })
})
