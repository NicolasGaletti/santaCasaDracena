import { describe, expect, it } from 'vitest'
import { sessaoPorLinkDeEmail } from './sessao'

describe('sessaoPorLinkDeEmail', () => {
  it('aceita amr otp', () => expect(sessaoPorLinkDeEmail({ amr: [{ method: 'otp', timestamp: 1 }] })).toBe(true))
  it('aceita recovery e invite', () => {
    expect(sessaoPorLinkDeEmail({ amr: [{ method: 'recovery' }] })).toBe(true)
    expect(sessaoPorLinkDeEmail({ amr: [{ method: 'invite' }] })).toBe(true)
  })
  it('rejeita senha, ausente ou malformado', () => {
    expect(sessaoPorLinkDeEmail({ amr: [{ method: 'password' }] })).toBe(false)
    expect(sessaoPorLinkDeEmail({})).toBe(false)
    expect(sessaoPorLinkDeEmail({ amr: 'otp' })).toBe(false)
  })
})
