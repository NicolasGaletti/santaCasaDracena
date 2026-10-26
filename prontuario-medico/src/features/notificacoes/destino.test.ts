import { describe, expect, it } from 'vitest'
import { destinoNotificacao } from './destino'

describe('destinoNotificacao', () => {
  it('validação pendente abre a revisão da evolução', () => {
    expect(destinoNotificacao({ tipo: 'validacao_pendente', internacao_id: 'i1', evolucao_id: 'e1' })).toBe('/validacao?evolucao=e1')
  })
  it('demais tipos abrem o prontuário', () => {
    expect(destinoNotificacao({ tipo: 'evolucao_devolvida', internacao_id: 'i1', evolucao_id: 'e1' })).toBe('/internacoes/i1')
  })
  it('sem internação, fica na lista', () => {
    expect(destinoNotificacao({ tipo: 'evolucao_validada', internacao_id: null, evolucao_id: null })).toBe('/notificacoes')
  })
})
