const FUSO_SP = 'America/Sao_Paulo'

function partesSP(instante: Date): Record<string, number> {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_SP,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante)
  return Object.fromEntries(partes.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]))
}

/** Agora no relógio de São Paulo, no formato do input datetime-local (YYYY-MM-DDTHH:mm). */
export function agoraLocalSP(agora: Date = new Date()): string {
  const p = partesSP(agora)
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${dois(p.month)}-${dois(p.day)}T${dois(p.hour)}:${dois(p.minute)}`
}

/** Converte "YYYY-MM-DDTHH:mm" (relógio de São Paulo) em instante ISO; null se inválido. */
export function localSPParaIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!m) return null
  const [ano, mes, dia, hora, minuto] = m.slice(1).map(Number)
  const alvo = Date.UTC(ano, mes - 1, dia, hora, minuto)
  // Ajusta pelo deslocamento de SP naquele instante (sem horário de verão hoje, mas sem supor isso).
  let instante = alvo + 3 * 3600_000
  for (let i = 0; i < 2; i++) {
    const p = partesSP(new Date(instante))
    instante += alvo - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  }
  const data = new Date(instante)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

/** dd/mm/aaaa de um instante, no relógio de São Paulo. */
export function formatarDataSP(iso: string): string {
  const p = partesSP(new Date(iso))
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${dois(p.day)}/${dois(p.month)}/${p.year}`
}
