import { Cake, CalendarDays, IdCard, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { CampoLeito } from '@/features/evolucao/campo-leito'
import { formatarData, idade } from '@/lib/datas'
import { iniciais } from '@/lib/iniciais'
import type { LinhaInternacao } from './consultas'

function Meta({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-cabecalho-suave [&_svg]:size-4 [&_svg]:shrink-0">
      {icone}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}

/** Cabeçalho escuro do paciente: avatar, nome e metadados; no celular os metadados viram chips. */
export function CabecalhoPaciente({
  linha,
  diasInternado,
  permitirTrocarLeito = true,
}: {
  linha: LinhaInternacao
  diasInternado: number
  /** Falso na validação: lá não se troca o leito. */
  permitirTrocarLeito?: boolean
}) {
  const anos = idade(linha.data_nascimento)
  const internado = linha.status === 'INTERNADO'
  const textoAnos = `${anos} ${anos === 1 ? 'ano' : 'anos'}`
  const textoDias = `${diasInternado} ${diasInternado === 1 ? 'dia' : 'dias'}`

  return (
    <section
      data-slot="cabecalho-paciente"
      aria-labelledby="titulo-paciente"
      className="relative flex min-w-0 flex-col gap-3 rounded-xl bg-cabecalho px-4 py-4 text-cabecalho-foreground sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-4 sm:pr-44">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-decorativo font-heading text-base font-bold text-white sm:size-12 sm:text-lg"
        >
          {iniciais(linha.nome)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 id="titulo-paciente" title={linha.nome} className="truncate font-heading text-lg leading-tight font-bold sm:text-xl">
            {linha.nome}
          </h1>
          <p className="mt-0.5 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-[13px] text-cabecalho-suave">
            <Meta icone={<Cake aria-hidden />}>
              <span className="sm:hidden">{textoAnos}</span>
              <span className="hidden sm:inline">
                D.N. <b className="text-white">{formatarData(linha.data_nascimento)}</b> ({textoAnos})
              </span>
            </Meta>
            <span className="hidden sm:contents">
              <Meta icone={<Users aria-hidden />}>
                <b className="text-white">{linha.equipe_nome}</b>
              </Meta>
              <Meta icone={<IdCard aria-hidden />}>
                Convênio <b className="text-cabecalho-destaque">{linha.convenio}</b>
              </Meta>
              <Meta icone={<CalendarDays aria-hidden />}>
                {internado ? 'Internado há' : 'Internação de'} <b className="text-white">{textoDias}</b>
              </Meta>
            </span>
          </p>
        </div>
      </div>

      <ul className="flex min-w-0 flex-wrap gap-2 text-[12px] sm:hidden" aria-label="Dados da internação">
        <li className="max-w-full truncate rounded-full bg-slate-800 px-2.5 py-1">{linha.equipe_nome}</li>
        <li className="max-w-full truncate rounded-full bg-slate-800 px-2.5 py-1 text-teal-300">{linha.convenio}</li>
        <li className="rounded-full bg-slate-800 px-2.5 py-1">{textoDias}</li>
        <li className="rounded-full bg-slate-800 px-2.5 py-1 font-semibold">{internado ? 'Internado' : 'Alta'}</li>
      </ul>

      <div className="sm:absolute sm:top-4 sm:right-6">
        <CampoLeito internacaoId={linha.internacao_id} leitoInicial={linha.leito_ala} editavel={internado && permitirTrocarLeito} />
      </div>
    </section>
  )
}
