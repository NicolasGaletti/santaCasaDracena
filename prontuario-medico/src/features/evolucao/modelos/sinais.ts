import { z } from 'zod';

const numeroFaixa = (min: number, max: number) =>
  z.number().min(min).max(max).nullable().default(null);

/** Sinais vitais: compartilhados pelos modelos médico e simples. Campos ausentes viram vazio. */
export const sinaisSchema = z.object({
  pa: z.string().regex(/^\d{2,3}\/\d{2,3}$|^$/).default(''),
  fc: numeroFaixa(0, 300),
  fr: numeroFaixa(0, 80),
  temp: numeroFaixa(25, 45),
  sato2: numeroFaixa(0, 100),
  dextro: numeroFaixa(0, 1000),
  diurese: numeroFaixa(0, 20000),
});

export type Sinais = z.infer<typeof sinaisSchema>;

export function sinaisVazios(): Sinais {
  return { pa: '', fc: null, fr: null, temp: null, sato2: null, dextro: null, diurese: null };
}
