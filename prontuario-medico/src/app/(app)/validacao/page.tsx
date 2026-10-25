import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CabecalhoPaciente } from '@/features/internacoes/cabecalho-paciente'
import { buscarRevisao, listarPendentes } from '@/features/validacao/consultas'
import { ListaPendentes } from '@/features/validacao/lista-pendentes'
import { RevisaoEvolucao } from '@/features/validacao/revisao-evolucao'
import { exigirProfissional } from '@/lib/auth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Validação é exclusiva do médico. Com `?evolucao=`, mostra a leitura completa para validar ou devolver. */
export default async function PaginaValidacao({ searchParams }: { searchParams: Promise<{ evolucao?: string }> }) {
  const profissional = await exigirProfissional()
  if (profissional.perfil !== 'medico') notFound()

  const { evolucao } = await searchParams
  if (evolucao !== undefined) {
    if (!UUID.test(evolucao)) notFound()
    const revisao = await buscarRevisao(evolucao)
    if (!revisao) notFound()
    return (
      <>
        <Link href="/validacao" className="inline-flex min-h-11 w-fit items-center font-semibold text-primary underline-offset-4 hover:underline">
          Voltar para a lista
        </Link>
        <CabecalhoPaciente linha={revisao.internacao} />
        <RevisaoEvolucao revisao={revisao} />
      </>
    )
  }

  const pendentes = await listarPendentes()
  return (
    <section className="flex flex-col gap-4" aria-labelledby="titulo-validacao">
      <h1 id="titulo-validacao" className="text-2xl font-bold leading-snug">
        Validação
      </h1>
      <ListaPendentes pendentes={pendentes} />
    </section>
  )
}
