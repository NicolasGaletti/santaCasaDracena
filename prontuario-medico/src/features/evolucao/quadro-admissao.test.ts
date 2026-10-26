import { describe, expect, it } from 'vitest'
import { rascunhoMedicaInicial } from './quadro-admissao'
import { rascunhoMedicaVazio } from './modelos/medica'

describe('rascunhoMedicaInicial', () => {
  it('sem quadro devolve o rascunho vazio', () => {
    expect(rascunhoMedicaInicial(null)).toEqual(rascunhoMedicaVazio())
  })

  it('preenche só os campos não vazios, sem espaços nas pontas', () => {
    const d = rascunhoMedicaInicial({ diagnostico_inicial: ' IAMSSST ', comorbidades: '   ', muc: null })
    expect(d.diagnosticos).toBe('IAMSSST')
    expect(d.comorbidades).toBe('')
    expect(d.muc).toBe('')
  })

  it('preenche os três campos', () => {
    const d = rascunhoMedicaInicial({ diagnostico_inicial: 'IAMSSST', comorbidades: 'HAS, DM2', muc: 'AAS 100mg' })
    expect([d.diagnosticos, d.comorbidades, d.muc]).toEqual(['IAMSSST', 'HAS, DM2', 'AAS 100mg'])
  })
})
