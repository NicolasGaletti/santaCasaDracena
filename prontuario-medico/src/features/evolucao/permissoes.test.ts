import { describe, expect, it } from 'vitest';
import { categoriaAusente, exigeConselho, podeCriarAdendo } from './permissoes';

describe('permissoes de evolução', () => {
  it('multiprofissional sem categoria está bloqueado', () => {
    expect(categoriaAusente('multiprofissional', null)).toBe(true);
    expect(categoriaAusente('multiprofissional', '')).toBe(true);
  });

  it('multiprofissional com categoria e perfis médicos não estão bloqueados', () => {
    expect(categoriaAusente('multiprofissional', 'enfermagem')).toBe(false);
    expect(categoriaAusente('medico', null)).toBe(false);
    expect(categoriaAusente('academico', null)).toBe(false);
  });

  it('acadêmico não exige conselho', () => {
    expect(exigeConselho('academico')).toBe(false);
    expect(exigeConselho('multiprofissional')).toBe(true);
  });
});

describe('podeCriarAdendo', () => {
  it('autor da original membro da equipe pode criar adendo, em qualquer perfil que evolui', () => {
    expect(podeCriarAdendo('residente', true, true)).toBe(true);
    expect(podeCriarAdendo('multiprofissional', true, true)).toBe(true);
    expect(podeCriarAdendo('academico', true, true)).toBe(true);
  });

  it('autor da original fora da equipe não cria adendo', () => {
    expect(podeCriarAdendo('residente', true, false)).toBe(false);
    expect(podeCriarAdendo('multiprofissional', true, false)).toBe(false);
    expect(podeCriarAdendo('academico', true, false)).toBe(false);
  });

  it('médico membro da equipe pode criar adendo de evolução de outro', () => {
    expect(podeCriarAdendo('medico', false, true)).toBe(true);
  });

  it('médico fora da equipe não cria adendo de evolução de outro', () => {
    expect(podeCriarAdendo('medico', false, false)).toBe(false);
  });

  it('residente que não é autor não cria adendo, mesmo na equipe', () => {
    expect(podeCriarAdendo('residente', false, true)).toBe(false);
  });

  it('recepção e admin nunca criam adendo', () => {
    expect(podeCriarAdendo('recepcao', false, true)).toBe(false);
    expect(podeCriarAdendo('admin', true, true)).toBe(false);
  });
});
