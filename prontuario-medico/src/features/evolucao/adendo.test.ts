import { describe, expect, it } from 'vitest';
import { tituloAdendo } from './adendo';

describe('tituloAdendo', () => {
  it('mostra a data e a hora da original no fuso de São Paulo', () => {
    // 25/10/2026 14:05 em São Paulo (UTC-3)
    expect(tituloAdendo('2026-10-25T17:05:00Z')).toBe('Adendo à evolução de 25/10/2026 14:05');
  });
});
