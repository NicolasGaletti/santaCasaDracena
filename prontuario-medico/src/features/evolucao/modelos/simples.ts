import { z } from 'zod';
import { sinaisSchema, sinaisVazios, type Sinais } from './sinais';

const texto = z.string().default('');

/** Modelo das categorias não médicas: evolução, sinais vitais e plano. */
export const modeloSimplesV1 = z.object({
  modelo_versao: z.literal('simples@1'),
  texto: texto,
  sinais: sinaisSchema,
  plano: texto,
});

export type DadosSimples = z.infer<typeof modeloSimplesV1>;

export function rascunhoSimplesVazio(): DadosSimples {
  return { modelo_versao: 'simples@1', texto: '', sinais: sinaisVazios(), plano: '' };
}

export function validarParaEnviarSimples(d: DadosSimples): string[] {
  const erros: string[] = [];
  if (d.texto.trim() === '') erros.push('Evolução é obrigatória.');
  if (d.plano.trim() === '') erros.push('Plano é obrigatório.');
  return erros;
}

/** Lê `dados` tolerando rascunhos antigos ou incompletos: campo ausente vira vazio ou nulo. */
export function lerDadosSimples(json: unknown): DadosSimples {
  const base = rascunhoSimplesVazio();
  const obj = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const sinaisObj = (obj.sinais && typeof obj.sinais === 'object' ? obj.sinais : {}) as Record<string, unknown>;
  const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const sinais: Sinais = {
    pa: typeof sinaisObj.pa === 'string' ? sinaisObj.pa : base.sinais.pa,
    fc: numero(sinaisObj.fc),
    fr: numero(sinaisObj.fr),
    temp: numero(sinaisObj.temp),
    sato2: numero(sinaisObj.sato2),
    dextro: numero(sinaisObj.dextro),
    diurese: numero(sinaisObj.diurese),
  };
  return {
    modelo_versao: 'simples@1',
    texto: typeof obj.texto === 'string' ? obj.texto : '',
    sinais,
    plano: typeof obj.plano === 'string' ? obj.plano : '',
  };
}
