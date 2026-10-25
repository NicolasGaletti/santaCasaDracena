export const ROTULO_CATEGORIA: Record<string, string> = {
  medica: 'Médica',
  enfermagem: 'Enfermagem',
  fisioterapia: 'Fisioterapia',
  nutricao: 'Nutrição',
  psicologia: 'Psicologia',
  fonoaudiologia: 'Fonoaudiologia',
  servico_social: 'Serviço social',
}

/** Título do formulário das categorias não médicas: "Evolução de <rótulo da categoria>". */
export function tituloEvolucao(categoria: string): string {
  return `Evolução de ${ROTULO_CATEGORIA[categoria] ?? categoria}`
}
