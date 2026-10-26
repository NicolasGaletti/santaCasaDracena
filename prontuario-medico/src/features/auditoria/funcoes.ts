export const TAMANHO_PAGINA = 50

export type AbaAuditoria = 'acessos' | 'alteracoes'

export type FiltrosAuditoria = {
  aba: AbaAuditoria
  de?: string
  ate?: string
  profissional?: string
  pagina: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Data YYYY-MM-DD válida no calendário; qualquer outra coisa vira undefined. */
export function dataValida(valor: string | undefined): string | undefined {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined
  const d = new Date(`${valor}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor ? undefined : valor
}

export function lerFiltros(params: Record<string, string | string[] | undefined>): FiltrosAuditoria {
  const um = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : undefined)
  const pagina = Number(um('pagina'))
  const profissional = um('profissional')
  return {
    aba: um('aba') === 'alteracoes' ? 'alteracoes' : 'acessos',
    de: dataValida(um('de')),
    ate: dataValida(um('ate')),
    profissional: profissional && UUID.test(profissional) ? profissional : undefined,
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
  }
}

/** Limites do período em America/Sao_Paulo (sem horário de verão desde 2019: UTC-3). Fim exclusivo. */
export function limitesPeriodo(de?: string, ate?: string): { inicio?: string; fim?: string } {
  let fim: string | undefined
  if (ate) {
    const d = new Date(`${ate}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    fim = `${d.toISOString().slice(0, 10)}T00:00:00-03:00`
  }
  return { inicio: de ? `${de}T00:00:00-03:00` : undefined, fim }
}

export function queryAuditoria(f: Partial<FiltrosAuditoria>): string {
  const q = new URLSearchParams()
  if (f.aba === 'alteracoes') q.set('aba', 'alteracoes')
  if (f.de) q.set('de', f.de)
  if (f.ate) q.set('ate', f.ate)
  if (f.profissional) q.set('profissional', f.profissional)
  if (f.pagina && f.pagina > 1) q.set('pagina', String(f.pagina))
  const texto = q.toString()
  return texto ? `/auditoria?${texto}` : '/auditoria'
}

const ROTULO_ACAO: Record<string, string> = {
  abrir_prontuario: 'Abriu o prontuário',
  ver_anexo: 'Viu um anexo',
}
export const rotuloAcao = (acao: string) => ROTULO_ACAO[acao] ?? acao

const ROTULO_TABELA: Record<string, string> = {
  pacientes: 'Pacientes',
  internacoes: 'Internações',
  internacoes_clinico: 'Dados clínicos',
  evolucoes: 'Evoluções',
  anexos: 'Anexos',
  profissionais: 'Profissionais',
  equipes: 'Equipes',
  membros_equipe: 'Membros de equipe',
  convites: 'Convites',
}
export const rotuloTabela = (t: string) => ROTULO_TABELA[t] ?? t

const ROTULO_OPERACAO: Record<string, string> = { INSERT: 'Criação', UPDATE: 'Alteração', DELETE: 'Remoção' }
export const rotuloOperacao = (o: string) => ROTULO_OPERACAO[o] ?? o

type Json = Record<string, unknown> | null

/** Só nomes de colunas alteradas, nunca valores (evita expor texto clínico numa lista). */
export function resumoDiff(operacao: string, antes: unknown, depois: unknown): string {
  if (operacao === 'INSERT') return 'criado'
  if (operacao === 'DELETE') return 'removido'
  const a = (antes ?? {}) as NonNullable<Json>
  const d = (depois ?? {}) as NonNullable<Json>
  const colunas = [...new Set([...Object.keys(a), ...Object.keys(d)])]
    .filter((c) => JSON.stringify(a[c]) !== JSON.stringify(d[c]))
    .sort()
  return colunas.length > 0 ? colunas.join(', ') : 'sem mudança de valores'
}
