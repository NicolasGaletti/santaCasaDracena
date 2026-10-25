import { z } from 'zod';

const texto = z.string().default('');
const numeroFaixa = (min: number, max: number) =>
  z.number().min(min).max(max).nullable().default(null);

export const modeloMedicaV1 = z.object({
  modelo_versao: z.literal('medica@1'),
  diagnosticos: texto,
  comorbidades: texto,
  muc: texto,
  evolucao_clinica: texto,
  ecg: texto,
  exames_imagem: texto,
  exames_laboratoriais: texto,
  sinais: z.object({
    pa: z.string().regex(/^\d{2,3}\/\d{2,3}$|^$/).default(''),
    fc: numeroFaixa(0, 300),
    fr: numeroFaixa(0, 80),
    temp: numeroFaixa(25, 45),
    sato2: numeroFaixa(0, 100),
    dextro: numeroFaixa(0, 1000),
    diurese: numeroFaixa(0, 20000),
  }),
  exame_fisico: z.object({
    geral: texto,
    ar: texto,
    acv: texto,
    abdome: texto,
    membros: texto,
    neuro: texto,
  }),
  conduta: texto,
});

export type DadosMedica = z.infer<typeof modeloMedicaV1>;

export function rascunhoMedicaVazio(): DadosMedica {
  return {
    modelo_versao: 'medica@1',
    diagnosticos: '',
    comorbidades: '',
    muc: '',
    evolucao_clinica: '',
    ecg: '',
    exames_imagem: '',
    exames_laboratoriais: '',
    sinais: { pa: '', fc: null, fr: null, temp: null, sato2: null, dextro: null, diurese: null },
    exame_fisico: {
      geral: 'REG, hidratada, hipocorada +2/+4, anictérica, acianótica, afebril',
      ar: 'MV + bilateralmente, SRA',
      acv: 'RCR, 2T, BNF, taquicárdicas, sem sopro audível',
      abdome: 'globoso, RHA +, flácido, sem VCM, indolor a palpação.',
      membros: 'simétricos, panturrilhas livres, sem edemas, TEC < 3 seg.',
      neuro: 'pupilas isocóricas e fotorreagentes',
    },
    conduta: '',
  };
}

export function validarParaFinalizar(d: DadosMedica): string[] {
  const erros: string[] = [];
  if (d.evolucao_clinica.trim() === '') erros.push('Evolução clínica é obrigatória.');
  if (d.conduta.trim() === '') erros.push('Conduta é obrigatória.');
  return erros;
}
