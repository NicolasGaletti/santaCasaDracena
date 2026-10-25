import { formatarData, idade } from '@/lib/datas'
import { CampoLeito } from '@/features/evolucao/campo-leito'
import type { LinhaInternacao } from './consultas'

export function CabecalhoPaciente({ linha }: { linha: LinhaInternacao }) {
  const anos = idade(linha.data_nascimento)
  const internado = linha.status === 'INTERNADO'

  return (
    <section aria-labelledby="titulo-paciente" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-muted-foreground">
          {internado ? 'Internado' : 'Alta'}
        </p>
        <h1 id="titulo-paciente" className="break-words text-2xl font-bold leading-snug">
          {linha.nome}
        </h1>
        <p className="text-sm text-muted-foreground">
          D.N. {formatarData(linha.data_nascimento)} · {anos} {anos === 1 ? 'ano' : 'anos'}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Convênio</dt>
          <dd className="font-semibold">{linha.convenio}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Equipe</dt>
          <dd className="font-semibold">{linha.equipe_nome}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Médico responsável</dt>
          <dd className="font-semibold">{linha.medico_responsavel_nome ?? 'Não informado'}</dd>
        </div>
      </dl>

      <CampoLeito internacaoId={linha.internacao_id} leitoInicial={linha.leito_ala} editavel={internado} />
    </section>
  )
}
