import { describe, expect, it } from 'vitest'
import { validarSenha } from './senha'

describe('validarSenha', () => {
  it('aceita 10+ com letra e número', () => expect(validarSenha('abcdefghi1')).toBeNull())
  it('recusa curta', () => expect(validarSenha('abc123')).toMatch(/10 caracteres/))
  it('recusa sem número', () => expect(validarSenha('abcdefghijk')).toMatch(/letra e um número/))
  it('recusa sem letra', () => expect(validarSenha('12345678901')).toMatch(/letra e um número/))
})
