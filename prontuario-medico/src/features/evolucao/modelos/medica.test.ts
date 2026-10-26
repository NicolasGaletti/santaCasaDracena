import { describe, expect, it } from 'vitest';
import {
  modeloMedicaV1,
  rascunhoMedicaVazio,
  SUGESTOES_EXAME_FISICO,
  validarParaFinalizar,
} from './medica';

describe('modelo medica v1', () => {
  it('rascunho vazio passa no schema', () => {
    const r = modeloMedicaV1.safeParse(rascunhoMedicaVazio());
    expect(r.success).toBe(true);
  });

  it('fc 400 rejeitado', () => {
    const d = { ...rascunhoMedicaVazio(), sinais: { ...rascunhoMedicaVazio().sinais, fc: 400 } };
    expect(modeloMedicaV1.safeParse(d).success).toBe(false);
  });

  it('pa "12/8" rejeitada, "120/80" aceita', () => {
    const base = rascunhoMedicaVazio();
    const com = (pa: string) => ({ ...base, sinais: { ...base.sinais, pa } });
    expect(modeloMedicaV1.safeParse(com('12/8')).success).toBe(false);
    expect(modeloMedicaV1.safeParse(com('120/80')).success).toBe(true);
  });

  it('finalizar exige evolucao_clinica e conduta', () => {
    const vazio = rascunhoMedicaVazio();
    expect(validarParaFinalizar(vazio).length).toBeGreaterThan(0);
    const ok = { ...vazio, evolucao_clinica: 'Paciente estável', conduta: 'Manter esquema' };
    expect(validarParaFinalizar(ok)).toEqual([]);
  });

  it('rascunho traz exame físico vazio e sinais nulos', () => {
    const d = rascunhoMedicaVazio();
    expect(d.modelo_versao).toBe('medica@1');
    expect(d.sinais.fc).toBeNull();
    expect(d.sinais.pa).toBe('');
    expect(Object.values(d.exame_fisico)).toEqual(['', '', '', '', '', '']);
  });

  it('sugestões de exame físico têm as mesmas chaves e texto padrão', () => {
    expect(Object.keys(SUGESTOES_EXAME_FISICO)).toEqual(Object.keys(rascunhoMedicaVazio().exame_fisico));
    expect(SUGESTOES_EXAME_FISICO.geral).toBe('REG, hidratada, hipocorada +2/+4, anictérica, acianótica, afebril');
    expect(SUGESTOES_EXAME_FISICO.neuro).toBe('pupilas isocóricas e fotorreagentes');
  });
});
