import { ListaInternacoes } from '@/features/internacoes/lista-internacoes'
import { listarEquipes, listarInternacoes } from '@/features/internacoes/consultas'

export default async function PaginaInternados({
  searchParams,
}: {
  searchParams: Promise<{ equipe?: string }>
}) {
  const { equipe } = await searchParams
  const equipes = await listarEquipes()
  const equipeId = equipes.some((e) => e.id === equipe) ? equipe : undefined
  const internacoes = await listarInternacoes({ status: 'INTERNADO', equipeId })

  return (
    <>
      <h1 className="text-2xl font-bold">Internados</h1>
      <ListaInternacoes
        internacoes={internacoes}
        equipes={equipes}
        equipeAtual={equipeId}
        caminho="/"
        mostrarStatusHoje
      />
    </>
  )
}
