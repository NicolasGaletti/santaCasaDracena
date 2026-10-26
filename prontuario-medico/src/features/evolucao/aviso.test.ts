import { describe, expect, it } from 'vitest'
import { mensagemDoAviso } from './aviso'

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
