import { describe, expect, it } from 'vitest'
import { agoraLocalSP, localSPParaIso } from './data-hora'

describe('data-hora da alta', () => {
  it('formata o relógio de São Paulo', () => {
    expect(agoraLocalSP(new Date('2026-10-25T02:30:00Z'))).toBe('2026-10-24T23:30')
  })
  it('converte local de SP em instante', () => {
    expect(localSPParaIso('2026-10-24T23:30')).toBe('2026-10-25T02:30:00.000Z')
  })
  it('recusa formato inválido', () => {
    expect(localSPParaIso('')).toBeNull()
    expect(localSPParaIso('24/10/2026 10:00')).toBeNull()
  })
})
