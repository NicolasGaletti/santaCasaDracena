import { describe, expect, it } from 'vitest';
import { diasEntre, formatarData, hojeSP, idade } from './datas';

describe('datas', () => {
  it('idade em fuso SP', () => {
    expect(idade('2000-10-26', new Date('2026-10-26T01:30:00Z'))).toBe(25);
  });

  it('aniversário hoje conta', () => {
    expect(idade('2000-10-25', new Date('2026-10-25T15:00:00Z'))).toBe(26);
  });

  it('hojeSP usa o calendário de São Paulo', () => {
    expect(hojeSP(new Date('2026-10-26T01:30:00Z'))).toBe('2026-10-25');
  });

  it('formatarData(\'2000-01-05\') → \'05/01/2000\'', () => {
    expect(formatarData('2000-01-05')).toBe('05/01/2000');
  });
});

describe('diasEntre', () => {
  it('conta dias pelo calendário de São Paulo', () => {
    expect(diasEntre('2026-08-05T10:00:00-03:00', new Date('2026-08-05T20:00:00-03:00'))).toBe(0)
    expect(diasEntre('2026-08-02T23:30:00-03:00', new Date('2026-08-05T00:10:00-03:00'))).toBe(3)
  })
})
