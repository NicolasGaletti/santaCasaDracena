import { describe, expect, it } from 'vitest'
import { FUNCOES, funcaoDe, funcaoPorValor } from './funcoes'

describe('funções de administração', () => {
  it('tem as 12 funções', () => {
    expect(FUNCOES).toHaveLength(12)
  })

  it('sugere o conselho por função', () => {
    expect(funcaoPorValor('enfermagem')?.conselho).toBe('COREN')
    expect(funcaoPorValor('medico')?.conselho).toBe('CRM')
    expect(funcaoPorValor('fonoaudiologia')?.conselho).toBe('CRFa')
    expect(funcaoPorValor('recepcao')?.conselho).toBeNull()
    expect(funcaoPorValor('interno')?.conselho).toBeNull()
  })

  it('mapeia perfil e categoria de volta para a função', () => {
    expect(funcaoDe('multiprofissional', 'nutricao')?.valor).toBe('nutricao')
    expect(funcaoDe('academico', 'medica')?.valor).toBe('interno')
    expect(funcaoDe('residente', 'medica')?.valor).toBe('residente')
    expect(funcaoDe('admin', null)?.rotulo).toBe('Admin')
  })
})
