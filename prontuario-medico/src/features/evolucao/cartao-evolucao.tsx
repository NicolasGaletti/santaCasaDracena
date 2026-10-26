import { Lock, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PilulaStatus } from '@/components/layout/barra-acoes'
import { GaleriaExames } from '@/features/anexos/galeria-exames'
import type { AnexoGaleria } from '@/features/anexos/consultas'
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

/** Cor do rótulo de cada campo, pelos tokens de exame e conduta. */
const COR_ROTULO: Partial<Record<string, string>> = {
  ecg: 'text-exame-ecg',
  exames_imagem: 'text-exame-imagem',
  exames_laboratoriais: 'text-exame-lab',
  conduta: 'text-conduta',
  evolucao_clinica: 'text-primary-suave-foreground',
}

/** Seção de exame preenchida, para as abas de ECG, imagem e laboratório. */
export function temSecao(d: DadosMedica, secao: SecaoExame): boolean {
  return d[secao].trim() !== ''
}

type Bloco = { chave: string; rotulo: string; valor: string }

function BlocoTexto({ b, destaque = false }: { b: Bloco; destaque?: boolean }) {
  return (
    <section className={destaque ? 'min-w-0 rounded-md border border-border bg-campo p-3' : 'min-w-0'}>
      <h4 className={`text-[12px] font-bold ${COR_ROTULO[b.chave] ?? 'text-texto-forte'}`}>{b.rotulo}</h4>
      <p className="mt-0.5 text-[13px] break-words whitespace-pre-line text-foreground [overflow-wrap:anywhere]">{b.valor}</p>
    </section>
  )
}

export function CartaoEvolucao({
  evolucao,
  secao,
  ocultarAcoes = false,
  anexosOutros = [],
}: {
  evolucao: EvolucaoTimeline
  secao?: SecaoExame
  ocultarAcoes?: boolean
  /** Anexos antigos do tipo OUTRO desta evolução. */
  anexosOutros?: AnexoGaleria[]
}) {
  const d = lerDadosMedica(evolucao.dados)
  const finalizada = evolucao.status === 'FINALIZADA'
  const data = evolucao.finalizada_em ?? evolucao.criado_em
  // Categorias não médicas usam o modelo simples: evolução, sinais vitais e plano.
  const simples = evolucao.categoria !== 'medica' ? lerDadosSimples(evolucao.dados) : null
  const sinais = simples ? simples.sinais : d.sinais
  const sinaisPreenchidos = ROTULO_SINAIS.filter(([k]) => sinais[k] !== null && sinais[k] !== '')
  const preenchido = (chave: string) => String(d[chave as keyof DadosMedica] ?? '').trim() !== ''
  const bloco = (chave: string): Bloco => {
    const s = SECOES.find((x) => x.chave === chave)!
    return { chave, rotulo: s.rotulo, valor: String(d[chave as keyof DadosMedica]) }
  }

  const blocosSimples: Bloco[] = simples
    ? [
        { chave: 'texto', rotulo: 'Evolução', valor: simples.texto },
        { chave: 'plano', rotulo: 'Plano', valor: simples.plano },
      ].filter((b) => b.valor.trim() !== '')
    : []
  // Resumo (diagnóstico, comorbidades, exames) em colunas; evolução e conduta em seguida.
  const resumo = simples || secao ? [] : ['diagnosticos', 'ecg', 'exames_imagem', 'exames_laboratoriais'].filter(preenchido).map(bloco)
  const comorbidades: Bloco | null =
    !simples && !secao && d.comorbidades.trim() ? { chave: 'comorbidades', rotulo: 'Comorbidades', valor: d.comorbidades } : null
  if (comorbidades) resumo.splice(Math.min(1, resumo.length), 0, comorbidades)
  const corpo = simples || secao ? [] : ['evolucao_clinica'].filter(preenchido).map(bloco)
  const conduta = !simples && !secao && preenchido('conduta') ? bloco('conduta') : null
  const soSecao = secao ? [bloco(secao)] : []
  const vazio = !secao && !simples && resumo.length + corpo.length === 0 && !conduta
  const semBlocos = vazio && blocosSimples.length === 0

  return (
    <article
      data-testid="cartao-evolucao"
      aria-labelledby={`evolucao-${evolucao.id}`}
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-l-4 border-border border-l-teal-decorativo bg-card p-4 text-card-foreground"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 id={`evolucao-${evolucao.id}`} className="min-w-0 text-sm font-bold">
          {formatarDataHora(data)}
        </h3>
        {finalizada ? (
          <PilulaStatus tipo="finalizada">
            <Lock aria-hidden />
            Finalizada
          </PilulaStatus>
        ) : (
          evolucao.status === 'AGUARDANDO_VALIDACAO' && <PilulaStatus tipo="aguardando">Aguardando validação</PilulaStatus>
        )}
        {evolucao.adendo_de && (
          <Badge data-testid="rotulo-adendo" variant="outline" className="shrink-0 px-2 text-xs">
            Adendo
          </Badge>
        )}
        <span className="ml-auto max-w-full truncate rounded bg-muted px-2 py-0.5 text-[12px] text-texto-forte">
          {ROTULO_CATEGORIA[evolucao.categoria] ?? evolucao.categoria}
        </span>
      </header>

      {resumo.length > 0 && (
        <div className={`grid gap-3 ${resumo.length > 1 ? 'sm:grid-cols-3' : ''}`}>
          {resumo.map((b) => (
            <BlocoTexto key={b.chave} b={b} />
          ))}
        </div>
      )}

      {!secao && sinaisPreenchidos.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
          {sinaisPreenchidos.map(([k, rotulo]) => (
            <div key={k} className="flex gap-1">
              <dt className="text-muted-foreground">{rotulo}:</dt>
              <dd className="font-semibold tabular-nums">{sinais[k]}</dd>
            </div>
          ))}
        </dl>
      )}

      {[...corpo, ...blocosSimples.slice(0, 1)].map((b) => (
        <BlocoTexto key={b.chave} b={b} destaque />
      ))}
      {conduta && <BlocoTexto b={conduta} />}
      {blocosSimples.slice(1).map((b) => (
        <BlocoTexto key={b.chave} b={b} />
      ))}
      {soSecao.map((b) => (
        <BlocoTexto key={b.chave} b={b} destaque />
      ))}

      {!secao && semBlocos && (
        <p className="text-sm text-muted-foreground">
          {evolucao.texto_livre.trim() ? evolucao.texto_livre : 'Sem registros nesta evolução.'}
        </p>
      )}

      {anexosOutros.length > 0 && (
        <section aria-label="Outros anexos" className="grid gap-2">
          <h4 className="text-[12px] font-bold text-texto-forte">Outros anexos</h4>
          <GaleriaExames anexos={anexosOutros} tipo="OUTRO" />
        </section>
      )}

      <footer className="flex flex-wrap items-center gap-2">
        <p className="flex min-w-0 max-w-full items-center gap-1 text-[12px] text-muted-foreground sm:mr-auto">
          <UserRound aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">{evolucao.autor_nome ?? 'Autor não identificado'}</span>
        </p>
        {/* Sem contêiner extra: o erro do adendo ocupa a linha inteira abaixo dos botões. */}
        {finalizada && !ocultarAcoes && <BotaoImprimirEvolucao evolucaoId={evolucao.id} />}
        {finalizada && !ocultarAcoes && (evolucao.qtd_anexos ?? 0) > 0 && <BotaoImprimirEvolucao evolucaoId={evolucao.id} comImagens />}
        {finalizada && !ocultarAcoes && evolucao.podeAdendo && <BotaoAdendo evolucaoId={evolucao.id} />}
      </footer>
    </article>
  )
}
