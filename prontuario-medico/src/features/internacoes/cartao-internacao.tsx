import Link from 'next/link'
import { PilulaStatus, type TipoStatus } from '@/components/layout/barra-acoes'
import { formatarDataSP } from '@/features/alta/data-hora'
import { rotuloTipoAlta } from '@/features/alta/tipos'
import { formatarData, idade } from '@/lib/datas'
import type { LinhaInternacao } from './consultas'

const ROTULO_STATUS: Record<string, { texto: string; tipo: TipoStatus }> = {
  FINALIZADA: { texto: 'Evoluído hoje', tipo: 'finalizada' },
  RASCUNHO: { texto: 'Rascunho', tipo: 'rascunho' },
  NENHUMA: { texto: 'Sem evolução', tipo: 'nenhuma' },
}

/** Quadro de largura fixa: leito curto em destaque; longo em texto menor, até 2 linhas com reticências. */
function QuadroLeito({ leito }: { leito: string }) {
  const curto = leito.length <= 5
  return (
    <span
      data-testid="leito-cartao"
      title={leito}
      aria-label={`Leito ${leito}`}
      className="flex w-20 shrink-0 items-center justify-center self-stretch overflow-hidden rounded-lg border border-primary-suave-borda bg-primary-suave px-1.5 text-center font-heading font-bold text-primary-suave-foreground"
    >
      <span
        aria-hidden
        className={`block max-w-full break-words tabular-nums ${
          curto ? 'text-xl' : 'line-clamp-2 text-[11px] leading-tight'
        }`}
      >
        {leito}
      </span>
    </span>
  )
}

export function CartaoInternacao({
  linha,
  mostrarStatusHoje,
}: {
  linha: LinhaInternacao
  mostrarStatusHoje: boolean
}) {
  const anos = idade(linha.data_nascimento)
  const status = ROTULO_STATUS[linha.status_hoje ?? 'NENHUMA'] ?? ROTULO_STATUS.NENHUMA
  const alta = linha.status === 'ALTA' && linha.alta_em

  return (
    <li>
      <Link
        href={`/internacoes/${linha.internacao_id}`}
        data-testid="cartao-internacao"
        className="flex min-h-24 items-stretch gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground transition-colors hover:border-primary"
      >
        <QuadroLeito leito={linha.leito_ala} />
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <h2 className="line-clamp-2 break-words font-heading text-base font-bold leading-snug">
            {linha.nome}
          </h2>
          <span className="text-sm text-muted-foreground">
            D.N. {formatarData(linha.data_nascimento)} · {anos} {anos === 1 ? 'ano' : 'anos'}
          </span>
          <span className="break-words text-sm text-muted-foreground">
            {linha.equipe_nome} · {linha.convenio}
          </span>
          {alta && (
            <span>
              <PilulaStatus tipo="alta">
                {linha.tipo_alta ? `${rotuloTipoAlta(linha.tipo_alta)} · ` : ''}Alta em {formatarDataSP(linha.alta_em!)}
              </PilulaStatus>
            </span>
          )}
          {mostrarStatusHoje && (
            <span>
              <PilulaStatus tipo={status.tipo}>{status.texto}</PilulaStatus>
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}
