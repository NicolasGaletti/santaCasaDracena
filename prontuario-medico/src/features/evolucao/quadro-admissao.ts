import { rascunhoMedicaVazio, type DadosMedica } from './modelos/medica'

export type QuadroAdmissao = {
  diagnostico_inicial: string | null
  comorbidades: string | null
  muc: string | null
}

/** Rascunho médico vazio com o quadro de admissão nos campos correspondentes (só os não vazios). */
export function rascunhoMedicaInicial(quadro: QuadroAdmissao | null): DadosMedica {
  const d = rascunhoMedicaVazio()
  if (!quadro) return d
  return {
    ...d,
    diagnosticos: quadro.diagnostico_inicial?.trim() ?? '',
    comorbidades: quadro.comorbidades?.trim() ?? '',
    muc: quadro.muc?.trim() ?? '',
  }
}
