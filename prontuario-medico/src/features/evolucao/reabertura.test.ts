import { describe, expect, it } from 'vitest'
import { horaLimiteReabertura, podeReabrir, type EvolucaoReabrivel } from './reabertura'

const AGORA = new Date('2026-10-27T15:00:00Z')
const ME = 'u-1'

const base: EvolucaoReabrivel = {
  id: 'e-1',
  status: 'FINALIZADA',
  autor_id: ME,
  validada_por: ME,
  adendo_de: null,
  finalizada_em: '2026-10-27T14:50:00Z',
  vias_impressas: 0,
}
const ctx = { perfil: 'medico', usuarioId: ME, internacaoInternada: true, temRascunhoProprio: false, agora: AGORA }

describe('podeReabrir', () => {
  it('autor médico, finalizada há 10 min, sem impressão, a mais recente: pode', () => {
    expect(podeReabrir(base, [base], ctx)).toBe(true)
  })

  it('recusa depois de 15 minutos', () => {
    expect(podeReabrir({ ...base, finalizada_em: '2026-10-27T14:44:59Z' }, [base], ctx)).toBe(false)
  })

  it('recusa se já foi impressa', () => {
    expect(podeReabrir({ ...base, vias_impressas: 1 }, [base], ctx)).toBe(false)
  })

  it('recusa quando o usuário não é o autor, não é médico ou há validador distinto', () => {
    expect(podeReabrir({ ...base, autor_id: 'u-2', validada_por: 'u-2' }, [base], ctx)).toBe(false)
    expect(podeReabrir(base, [base], { ...ctx, perfil: 'residente' })).toBe(false)
    expect(podeReabrir({ ...base, validada_por: 'u-2' }, [base], ctx)).toBe(false)
  })

  it('recusa adendo e evolução que não está finalizada', () => {
    expect(podeReabrir({ ...base, adendo_de: 'e-0' }, [base], ctx)).toBe(false)
    expect(podeReabrir({ ...base, status: 'RASCUNHO' }, [base], ctx)).toBe(false)
  })

  it('recusa se há finalizada mais recente ou adendo apontando para ela', () => {
    const maisNova = { ...base, id: 'e-2', finalizada_em: '2026-10-27T14:55:00Z' }
    expect(podeReabrir(base, [base, maisNova], ctx)).toBe(false)
    const adendo = { ...base, id: 'e-3', status: 'RASCUNHO' as const, adendo_de: 'e-1', finalizada_em: null }
    expect(podeReabrir(base, [base, adendo], ctx)).toBe(false)
  })

  it('recusa com alta ou com outro rascunho aberto', () => {
    expect(podeReabrir(base, [base], { ...ctx, internacaoInternada: false })).toBe(false)
    expect(podeReabrir(base, [base], { ...ctx, temRascunhoProprio: true })).toBe(false)
  })
})

describe('horaLimiteReabertura', () => {
  it('soma 15 minutos e mostra hh:mm em America/Sao_Paulo', () => {
    expect(horaLimiteReabertura('2026-10-27T14:50:00Z')).toBe('12:05')
  })
})
