import { describe, expect, it } from 'vitest'
import { internacaoDoAviso, mensagemDoAviso } from './aviso'

describe('mensagemDoAviso', () => {
  it('traduz só os valores conhecidos', () => {
    expect(mensagemDoAviso('finalizada')).toBe('Evolução finalizada.')
    expect(mensagemDoAviso('enviada')).toBe('Evolução enviada para validação.')
  })

  it('ignora texto arbitrário', () => {
    expect(mensagemDoAviso('<b>oi</b>')).toBeNull()
    expect(mensagemDoAviso('toString')).toBeNull()
    expect(mensagemDoAviso(undefined)).toBeNull()
    expect(mensagemDoAviso(null)).toBeNull()
  })
})

describe('internacaoDoAviso', () => {
  it('aceita só UUID', () => {
    const id = 'c0000000-0000-0000-0000-000000000001'
    expect(internacaoDoAviso(id)).toBe(id)
    expect(internacaoDoAviso('../../admin')).toBeNull()
    expect(internacaoDoAviso('javascript:alert(1)')).toBeNull()
    expect(internacaoDoAviso(null)).toBeNull()
  })
})
