import { ListaInternacoes } from '@/features/internacoes/lista-internacoes'
import { listarEquipes, listarInternacoes } from '@/features/internacoes/consultas'

export default async function PaginaAnteriores({
  searchParams,
}: {
  searchParams: Promise<{ equipe?: string }>
}) {
  const { equipe } = await searchParams
  const equipes = await listarEquipes()
  const equipeId = equipes.some((e) => e.id === equipe) ? equipe : undefined
  const internacoes = await listarInternacoes({ status: 'ALTA', equipeId })

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Internações anteriores</h1>
        <p className="text-sm text-muted-foreground">
          Internações encerradas. Somente leitura.
        </p>
      </div>
      <ListaInternacoes
        internacoes={internacoes}
        equipes={equipes}
        equipeAtual={equipeId}
        caminho="/anteriores"
        mostrarStatusHoje={false}
      />
    </>
  )
}
