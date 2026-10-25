import { describe, expect, it } from 'vitest';
import {
  lerDadosSimples,
  modeloSimplesV1,
  rascunhoSimplesVazio,
  validarParaEnviarSimples,
} from './simples';

describe('modelo simples v1', () => {
  it('rascunho vazio passa no schema', () => {
    expect(modeloSimplesV1.safeParse(rascunhoSimplesVazio()).success).toBe(true);
  });

  it('rascunho vazio usa o modelo simples@1 e sinais nulos', () => {
    const d = rascunhoSimplesVazio();
    expect(d.modelo_versao).toBe('simples@1');
    expect(d.texto).toBe('');
    expect(d.plano).toBe('');
    expect(d.sinais.fc).toBeNull();
    expect(d.sinais.pa).toBe('');
  });

  it('fc 400 rejeitado, pa "12/8" rejeitada', () => {
    const base = rascunhoSimplesVazio();
    expect(modeloSimplesV1.safeParse({ ...base, sinais: { ...base.sinais, fc: 400 } }).success).toBe(false);
    expect(modeloSimplesV1.safeParse({ ...base, sinais: { ...base.sinais, pa: '12/8' } }).success).toBe(false);
  });

  it('enviar exige texto e plano', () => {
    expect(validarParaEnviarSimples(rascunhoSimplesVazio())).toEqual([
      'Evolução é obrigatória.',
      'Plano é obrigatório.',
    ]);
    const ok = { ...rascunhoSimplesVazio(), texto: 'Paciente estável', plano: 'Manter curativo' };
    expect(validarParaEnviarSimples(ok)).toEqual([]);
  });

  it('texto só com espaços conta como vazio', () => {
    const d = { ...rascunhoSimplesVazio(), texto: '   ', plano: 'Plano' };
    expect(validarParaEnviarSimples(d)).toEqual(['Evolução é obrigatória.']);
  });

  it('lerDadosSimples tolera dados ausentes ou incompletos', () => {
    const d = lerDadosSimples({ texto: 'Evolução antiga', sinais: { fc: 'abc', pa: '120/80' } });
    expect(d.modelo_versao).toBe('simples@1');
    expect(d.texto).toBe('Evolução antiga');
    expect(d.plano).toBe('');
    expect(d.sinais.fc).toBeNull();
    expect(d.sinais.pa).toBe('120/80');
    expect(lerDadosSimples(null).sinais.temp).toBeNull();
  });
});
