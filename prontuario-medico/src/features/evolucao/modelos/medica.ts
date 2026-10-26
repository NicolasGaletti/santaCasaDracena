import { z } from 'zod';
import { sinaisSchema, sinaisVazios } from './sinais';

const texto = z.string().default('');

export const modeloMedicaV1 = z.object({
  modelo_versao: z.literal('medica@1'),
  diagnosticos: texto,
  comorbidades: texto,
  muc: texto,
  evolucao_clinica: texto,
  ecg: texto,
  exames_imagem: texto,
  exames_laboratoriais: texto,
  sinais: sinaisSchema,
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

/** Texto de exame normal: só aparece como placeholder dos campos, nunca como valor salvo. */
export const SUGESTOES_EXAME_FISICO: DadosMedica['exame_fisico'] = {
  geral: 'REG, hidratada, hipocorada +2/+4, anictérica, acianótica, afebril',
  ar: 'MV + bilateralmente, SRA',
  acv: 'RCR, 2T, BNF, taquicárdicas, sem sopro audível',
  abdome: 'globoso, RHA +, flácido, sem VCM, indolor a palpação.',
  membros: 'simétricos, panturrilhas livres, sem edemas, TEC < 3 seg.',
  neuro: 'pupilas isocóricas e fotorreagentes',
};

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
    sinais: sinaisVazios(),
    exame_fisico: { geral: '', ar: '', acv: '', abdome: '', membros: '', neuro: '' },
    conduta: '',
  };
}

export function validarParaFinalizar(d: DadosMedica): string[] {
  const erros: string[] = [];
  if (d.evolucao_clinica.trim() === '') erros.push('Evolução clínica é obrigatória.');
  if (d.conduta.trim() === '') erros.push('Conduta é obrigatória.');
  return erros;
}
