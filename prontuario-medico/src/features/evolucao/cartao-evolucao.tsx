import { Badge } from '@/components/ui/badge'
import { BotaoAdendo } from './botao-adendo'
import { BotaoImprimirEvolucao } from './botao-imprimir'
import type { DadosMedica } from './modelos/medica'
import { rascunhoMedicaVazio } from './modelos/medica'
import { lerDadosSimples } from './modelos/simples'
import { ROTULO_CATEGORIA } from './rotulos'

export type SecaoExame = 'ecg' | 'exames_imagem' | 'exames_laboratoriais'

export type EvolucaoTimeline = {
  id: string
  status: 'RASCUNHO' | 'AGUARDANDO_VALIDACAO' | 'FINALIZADA'
  categoria: string
  autor_nome: string | null
  criado_em: string
  finalizada_em: string | null
  dados: unknown
  texto_livre: string
  qtd_anexos?: number | null
  adendo_de?: string | null
  /** Calculado no servidor: quem pode abrir um adendo desta evolução finalizada. */
  podeAdendo?: boolean
}

const FUSO_SP = 'America/Sao_Paulo'

/**
 * Lê `dados` tolerando formatos antigos: campos ausentes viram vazio, nunca o texto padrão do exame físico.
 */
export function lerDadosMedica(json: unknown): DadosMedica {
  const base = rascunhoMedicaVazio()
  const obj = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const texto = (v: unknown) => (typeof v === 'string' ? v : '')
  const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const sinais = (obj.sinais && typeof obj.sinais === 'object' ? obj.sinais : {}) as Record<string, unknown>
  const exame = (obj.exame_fisico && typeof obj.exame_fisico === 'object' ? obj.exame_fisico : {}) as Record<
    string,
    unknown
  >
  return {
    modelo_versao: 'medica@1',
    diagnosticos: texto(obj.diagnosticos),
    comorbidades: texto(obj.comorbidades),
    muc: texto(obj.muc),
    evolucao_clinica: texto(obj.evolucao_clinica),
    ecg: texto(obj.ecg),
    exames_imagem: texto(obj.exames_imagem),
    exames_laboratoriais: texto(obj.exames_laboratoriais),
    sinais: {
      pa: typeof sinais.pa === 'string' ? sinais.pa : base.sinais.pa,
      fc: numero(sinais.fc),
      fr: numero(sinais.fr),
      temp: numero(sinais.temp),
      sato2: numero(sinais.sato2),
      dextro: numero(sinais.dextro),
      diurese: numero(sinais.diurese),
    },
    exame_fisico: {
      geral: texto(exame.geral),
      ar: texto(exame.ar),
      acv: texto(exame.acv),
      abdome: texto(exame.abdome),
      membros: texto(exame.membros),
      neuro: texto(exame.neuro),
    },
    conduta: texto(obj.conduta),
  }
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: FUSO_SP,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const SECOES: { chave: SecaoExame | 'diagnosticos' | 'evolucao_clinica' | 'conduta'; rotulo: string }[] = [
  { chave: 'diagnosticos', rotulo: 'Diagnósticos' },
  { chave: 'evolucao_clinica', rotulo: 'Evolução clínica' },
  { chave: 'ecg', rotulo: 'ECG' },
  { chave: 'exames_imagem', rotulo: 'Exames de imagem' },
  { chave: 'exames_laboratoriais', rotulo: 'Exames laboratoriais' },
  { chave: 'conduta', rotulo: 'Conduta' },
]

const ROTULO_SINAIS: [keyof DadosMedica['sinais'], string][] = [
  ['pa', 'PA'],
  ['fc', 'FC'],
  ['fr', 'FR'],
  ['temp', 'Temp'],
  ['sato2', 'SatO2'],
  ['dextro', 'Dextro'],
  ['diurese', 'Diurese'],
]

/** Seção de exame preenchida, para o filtro da timeline. */
export function temSecao(d: DadosMedica, secao: SecaoExame): boolean {
  return d[secao].trim() !== ''
}

export function CartaoEvolucao({
  evolucao,
  secao,
  ocultarAcoes = false,
}: {
  evolucao: EvolucaoTimeline
  secao?: SecaoExame
  ocultarAcoes?: boolean
}) {
  const d = lerDadosMedica(evolucao.dados)
  const finalizada = evolucao.status === 'FINALIZADA'
  const data = evolucao.finalizada_em ?? evolucao.criado_em
  // Categorias não médicas usam o modelo simples: evolução, sinais vitais e plano.
  const simples = evolucao.categoria !== 'medica' ? lerDadosSimples(evolucao.dados) : null
  const sinais = simples ? simples.sinais : d.sinais
  const sinaisPreenchidos = ROTULO_SINAIS.filter(([k]) => sinais[k] !== null && sinais[k] !== '')
  const blocos: { chave: string; rotulo: string; valor: string }[] = simples
    ? [
        { chave: 'texto', rotulo: 'Evolução', valor: simples.texto },
        { chave: 'plano', rotulo: 'Plano', valor: simples.plano },
      ].filter((b) => b.valor.trim() !== '')
    : secao
      ? SECOES.filter((s) => s.chave === secao).map((s) => ({ chave: s.chave, rotulo: s.rotulo, valor: String(d[s.chave as keyof DadosMedica]) }))
      : SECOES.filter((s) => d[s.chave as keyof DadosMedica] && String(d[s.chave as keyof DadosMedica]).trim() !== '').map((s) => ({
          chave: s.chave,
          rotulo: s.rotulo,
          valor: String(d[s.chave as keyof DadosMedica]),
        }))

  return (
    <article
      data-testid="cartao-evolucao"
      aria-labelledby={`evolucao-${evolucao.id}`}
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`evolucao-${evolucao.id}`} className="font-bold leading-snug">
            {evolucao.autor_nome ?? 'Autor não identificado'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatarDataHora(data)} · {ROTULO_CATEGORIA[evolucao.categoria] ?? evolucao.categoria}
          </p>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          {evolucao.adendo_de && (
            <Badge data-testid="rotulo-adendo" variant="outline" className="shrink-0 px-2 text-xs">
              Adendo
            </Badge>
          )}
          {evolucao.status === 'AGUARDANDO_VALIDACAO' && (
            <Badge className="shrink-0 bg-status-nenhum-bg px-2 text-xs text-status-nenhum-fg">Aguardando validação</Badge>
          )}
        </div>
      </header>

      {!secao && sinaisPreenchidos.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          {sinaisPreenchidos.map(([k, rotulo]) => (
            <div key={k} className="flex gap-1">
              <dt className="text-muted-foreground">{rotulo}:</dt>
              <dd className="font-semibold tabular-nums">{sinais[k]}</dd>
            </div>
          ))}
        </dl>
      )}

      {blocos.map((b) => (
        <section key={b.chave} className="flex flex-col gap-1">
          <h4 className="text-sm font-bold text-muted-foreground">{b.rotulo}</h4>
          <p className="whitespace-pre-line break-words">{b.valor}</p>
        </section>
      ))}

      {!secao && blocos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {evolucao.texto_livre.trim() ? evolucao.texto_livre : 'Sem registros nesta evolução.'}
        </p>
      )}

      {finalizada && !ocultarAcoes && (
        <footer className="flex flex-wrap gap-2">
          <BotaoImprimirEvolucao evolucaoId={evolucao.id} />
          {(evolucao.qtd_anexos ?? 0) > 0 && <BotaoImprimirEvolucao evolucaoId={evolucao.id} comImagens />}
          {evolucao.podeAdendo && <BotaoAdendo evolucaoId={evolucao.id} />}
        </footer>
      )}
    </article>
  )
}
