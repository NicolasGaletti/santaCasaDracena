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
        className="block h-full min-h-11 rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:border-primary"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold leading-snug">{linha.nome}</h2>
          {mostrarStatusHoje && (
            <Badge className={`shrink-0 ${status.classe}`}>{status.texto}</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          D.N. {formatarData(linha.data_nascimento)} ({anos} {anos === 1 ? 'ano' : 'anos'})
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Leito</dt>
            <dd className="font-semibold">{linha.leito_ala}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Equipe</dt>
            <dd className="font-semibold">{linha.equipe_nome}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Convênio</dt>
            <dd className="font-semibold">{linha.convenio}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Médico responsável</dt>
            <dd className="font-semibold">{linha.medico_responsavel_nome ?? '—'}</dd>
          </div>
        </dl>
      </Link>
    </li>
  )
}
