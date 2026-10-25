import { describe, expect, it } from 'vitest';
import { categoriaAusente, exigeConselho } from './permissoes';

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
