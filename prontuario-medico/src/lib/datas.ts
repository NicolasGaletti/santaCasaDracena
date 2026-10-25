import { format, parseISO } from 'date-fns';

const FUSO_SP = 'America/Sao_Paulo';

function partesSP(agora: Date): { ano: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_SP,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return { ano: valor('year'), mes: valor('month'), dia: valor('day') };
}

/** Data de hoje no calendário de São Paulo, no formato YYYY-MM-DD. */
export function hojeSP(agora: Date = new Date()): string {
  const { ano, mes, dia } = partesSP(agora);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Idade em anos completos, comparando o dia de hoje (SP) com a data de nascimento YYYY-MM-DD. */
export function idade(nascimento: string, agora: Date = new Date()): number {
  const [anoN, mesN, diaN] = nascimento.split('-').map(Number);
  const { ano, mes, dia } = partesSP(agora);
  let anos = ano - anoN;
  if (mes < mesN || (mes === mesN && dia < diaN)) anos -= 1;
  return anos;
}

/** Formata YYYY-MM-DD como dd/MM/yyyy sem deslocamento de fuso. */
export function formatarData(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy');
}
