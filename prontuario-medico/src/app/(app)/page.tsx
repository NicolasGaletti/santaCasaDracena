import { exigirNaoAdmin } from '@/lib/auth'
import { ListaInternacoes } from '@/features/internacoes/lista-internacoes'
import { listarConvenios, listarEquipes, listarInternacoes } from '@/features/internacoes/consultas'

export default async function PaginaInternados({
  searchParams,
}: {
  searchParams: Promise<{ equipe?: string; convenio?: string }>
}) {
  await exigirNaoAdmin()
  const { equipe, convenio } = await searchParams
  const [equipes, convenios] = await Promise.all([listarEquipes(), listarConvenios('INTERNADO')])
  const equipeId = equipes.some((e) => e.id === equipe) ? equipe : undefined
  const convenioAtual = convenios.includes(convenio ?? '') ? convenio : undefined
  const internacoes = await listarInternacoes({ status: 'INTERNADO', equipeId, convenio: convenioAtual })

  return (
    <>
      <h1 className="sr-only">Internados</h1>
      <ListaInternacoes
        internacoes={internacoes}
        equipes={equipes}
        equipeAtual={equipeId}
        convenios={convenios}
        convenioAtual={convenioAtual}
        caminho="/"
        mostrarStatusHoje
      />
    </>
  )
}
