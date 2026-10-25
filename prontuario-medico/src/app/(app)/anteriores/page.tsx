import { ListaInternacoes } from '@/features/internacoes/lista-internacoes'
import { listarConvenios, listarEquipes, listarInternacoes } from '@/features/internacoes/consultas'

export default async function PaginaAnteriores({
  searchParams,
}: {
  searchParams: Promise<{ equipe?: string; convenio?: string }>
}) {
  const { equipe, convenio } = await searchParams
  const [equipes, convenios] = await Promise.all([listarEquipes(), listarConvenios('ALTA')])
  const equipeId = equipes.some((e) => e.id === equipe) ? equipe : undefined
  const convenioAtual = convenios.includes(convenio ?? '') ? convenio : undefined
  const internacoes = await listarInternacoes({ status: 'ALTA', equipeId, convenio: convenioAtual })

  return (
    <>
      <div>
        <h1 className="sr-only">Internações anteriores</h1>
        <p className="text-sm text-muted-foreground">
          Internações encerradas. Somente leitura.
        </p>
      </div>
      <ListaInternacoes
        internacoes={internacoes}
        equipes={equipes}
        equipeAtual={equipeId}
        convenios={convenios}
        convenioAtual={convenioAtual}
        caminho="/anteriores"
        mostrarStatusHoje={false}
      />
    </>
  )
}
