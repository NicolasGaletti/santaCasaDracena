const FUSO_SP = 'America/Sao_Paulo'

/** Título do formulário de adendo: "Adendo à evolução de dd/mm/aaaa hh:mm", pela data da original. */
export function tituloAdendo(dataOriginal: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_SP,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(dataOriginal))
  const p = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((x) => x.type === tipo)?.value ?? ''
  return `Adendo à evolução de ${p('day')}/${p('month')}/${p('year')} ${p('hour')}:${p('minute')}`
}
