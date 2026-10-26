import { Input } from '@/components/ui/input'
import { RotuloCampo } from '@/components/layout/rotulo-campo'
import { sinaisSchema, type Sinais } from './modelos/sinais'

export type CampoSinal = keyof Sinais
export type BrutosSinais = Record<CampoSinal, string>

const CAMPOS: { chave: CampoSinal; curto: string; unidade: string; placeholder: string; modo: 'text' | 'decimal' }[] = [
  { chave: 'pa', curto: 'PA', unidade: 'mmHg', placeholder: '120/80', modo: 'text' },
  { chave: 'fc', curto: 'FC', unidade: 'bpm', placeholder: '80', modo: 'decimal' },
  { chave: 'fr', curto: 'FR', unidade: 'irpm', placeholder: '16', modo: 'decimal' },
  { chave: 'temp', curto: 'Temp', unidade: '°C', placeholder: '36,5', modo: 'decimal' },
  { chave: 'sato2', curto: 'SatO2', unidade: '%', placeholder: '98', modo: 'decimal' },
  { chave: 'dextro', curto: 'Dextro', unidade: 'mg/dL', placeholder: '100', modo: 'decimal' },
  { chave: 'diurese', curto: 'Diurese', unidade: 'mL/24 h', placeholder: '1500', modo: 'decimal' },
]

const rotuloDe = (c: (typeof CAMPOS)[number]) => `${c.curto} (${c.unidade})`

export function brutosDeSinais(s: Sinais): BrutosSinais {
  const texto = (n: number | null) => (n === null ? '' : String(n))
  return {
    pa: s.pa,
    fc: texto(s.fc),
    fr: texto(s.fr),
    temp: texto(s.temp),
    sato2: texto(s.sato2),
    dextro: texto(s.dextro),
    diurese: texto(s.diurese),
  }
}

/** Texto do campo numérico: vazio é "sem valor" (null); algo que não é número é inválido. */
function lerNumero(texto: string): { ok: true; valor: number | null } | { ok: false } {
  const t = texto.trim().replace(',', '.')
  if (t === '') return { ok: true, valor: null }
  const n = Number(t)
  return Number.isFinite(n) ? { ok: true, valor: n } : { ok: false }
}

/** Mensagem de erro do sinal, ou null. A faixa vem do próprio schema dos sinais. */
export function erroSinal(chave: CampoSinal, texto: string): string | null {
  const t = texto.trim()
  if (t === '') return null
  if (chave === 'pa') return /^\d{2,3}\/\d{2,3}$/.test(t) ? null : 'Use o formato 120/80.'
  const lido = lerNumero(t)
  if (!lido.ok) return 'Digite um número.'
  return sinaisSchema.shape[chave].safeParse(lido.valor).success ? null : 'Valor fora da faixa aceita.'
}

/** Mensagens de todos os campos inválidos, prefixadas pelo rótulo. */
export function errosDeSinais(brutos: BrutosSinais): string[] {
  return CAMPOS.flatMap((c) => {
    const e = erroSinal(c.chave, brutos[c.chave])
    return e ? [`${rotuloDe(c)}: ${e}`] : []
  })
}

/** Novos sinais para o texto digitado, ou null se o texto é inválido (o último valor válido é mantido). */
export function aplicarSinal(sinais: Sinais, chave: CampoSinal, texto: string): Sinais | null {
  if (erroSinal(chave, texto) !== null) return null
  const lido = lerNumero(texto)
  const valor = chave === 'pa' ? texto.trim() : lido.ok ? lido.valor : null
  return { ...sinais, [chave]: valor } as Sinais
}

/** Sinais vitais: 7 em linha (sm+) ou grade de 4 (celular). Quem chama guarda o estado dos brutos. */
export function CamposSinais({
  brutos,
  onAlterar,
}: {
  brutos: BrutosSinais
  onAlterar: (chave: CampoSinal, texto: string) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-3 rounded-lg border border-border bg-campo p-3 sm:grid-cols-7">
      {CAMPOS.map((c) => {
        const erro = erroSinal(c.chave, brutos[c.chave])
        return (
          <div key={c.chave} className="grid min-w-0 content-start gap-1">
            <RotuloCampo htmlFor={`ev-sinal-${c.chave}`} className="mb-0 flex-col items-center gap-0 text-center normal-case">
              <span className="uppercase">{c.curto}</span>{' '}
              <span className="block text-[10px] font-semibold text-muted-foreground">({c.unidade})</span>
            </RotuloCampo>
            <Input
              id={`ev-sinal-${c.chave}`}
              inputMode={c.modo}
              autoComplete="off"
              placeholder={c.placeholder}
              value={brutos[c.chave]}
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? `erro-sinal-${c.chave}` : undefined}
              onChange={(e) => onAlterar(c.chave, e.target.value)}
              className="bg-card px-1 text-center tabular-nums"
            />
            {erro && (
              <p id={`erro-sinal-${c.chave}`} className="text-[12px] font-semibold text-destructive">
                {erro}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
