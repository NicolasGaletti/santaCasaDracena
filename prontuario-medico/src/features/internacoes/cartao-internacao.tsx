import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatarData, idade } from '@/lib/datas'
import type { LinhaInternacao } from './consultas'

const ROTULO_STATUS: Record<string, { texto: string; classe: string }> = {
  FINALIZADA: { texto: 'Evoluído hoje', classe: 'bg-status-feito-bg text-status-feito-fg' },
  RASCUNHO: { texto: 'Rascunho', classe: 'bg-status-rascunho-bg text-status-rascunho-fg' },
  NENHUMA: { texto: 'Sem evolução', classe: 'bg-status-nenhum-bg text-status-nenhum-fg' },
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

  return (
    <li>
      <Link
        href={`/internacoes/${linha.internacao_id}`}
        data-testid="cartao-internacao"
        className="flex min-h-24 items-stretch gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground transition-colors hover:border-primary"
      >
        <span className="flex w-16 shrink-0 items-center justify-center rounded-tag bg-accent text-lg font-bold text-accent-foreground tabular-nums">
          {linha.leito_ala}
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <h2 className="line-clamp-2 break-words text-base font-bold leading-snug">
            {linha.nome}
          </h2>
          <span className="text-sm text-muted-foreground">
            D.N. {formatarData(linha.data_nascimento)} · {anos} {anos === 1 ? 'ano' : 'anos'}
          </span>
          <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="min-w-0 text-sm text-muted-foreground">
              {linha.equipe_nome} · {linha.convenio}
            </span>
            {mostrarStatusHoje && (
              <Badge className={`shrink-0 px-2 text-xs ${status.classe}`}>{status.texto}</Badge>
            )}
          </span>
        </span>
      </Link>
    </li>
  )
}
