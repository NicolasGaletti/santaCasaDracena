import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { diasEntre } from '@/lib/datas'
import { notFound } from 'next/navigation'
import { CabecalhoPaciente } from '@/features/internacoes/cabecalho-paciente'
import { buscarRevisao, listarPendentes } from '@/features/validacao/consultas'
import { ListaPendentes } from '@/features/validacao/lista-pendentes'
import { RevisaoEvolucao } from '@/features/validacao/revisao-evolucao'
import { exigirNaoAdmin } from '@/lib/auth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Validação é exclusiva do médico. Com `?evolucao=`, mostra a leitura completa para validar ou devolver. */
export default async function PaginaValidacao({ searchParams }: { searchParams: Promise<{ evolucao?: string }> }) {
  const profissional = await exigirNaoAdmin()
  if (profissional.perfil !== 'medico') notFound()

  const { evolucao } = await searchParams
  if (evolucao !== undefined) {
    if (!UUID.test(evolucao)) notFound()
    const revisao = await buscarRevisao(evolucao)
    const voltar = (
      <Link href="/validacao" className="inline-flex min-h-11 w-fit items-center gap-1 rounded-full border border-input bg-card px-4 text-[13px] font-semibold text-texto-forte hover:bg-muted">
        <ArrowLeft aria-hidden className="mr-1.5 size-4" />
        Voltar para a lista
      </Link>
    )
    if (!revisao) {
      return (
        <section className="flex flex-col gap-4">
          <p className="rounded-xl border border-border bg-card p-4 text-base font-semibold">Esta evolução já foi validada ou devolvida.</p>
          {voltar}
        </section>
      )
    }
    return (
      <>
        {voltar}
        <CabecalhoPaciente linha={revisao.internacao} diasInternado={diasEntre(revisao.internacao.admitido_em)} permitirTrocarLeito={false} />
        <RevisaoEvolucao revisao={revisao} />
      </>
    )
  }

  const pendentes = await listarPendentes()
  return (
    <section className="flex flex-col gap-4" aria-labelledby="titulo-validacao">
      <h1 id="titulo-validacao" className="text-xl font-bold leading-snug sm:text-2xl">
        Validação
      </h1>
      <ListaPendentes pendentes={pendentes} />
    </section>
  )
}
