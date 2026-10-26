import { notFound, redirect } from 'next/navigation'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Rota antiga da ficha: links e notificações antigos caem na ficha do prontuário, com a query preservada. */
export default async function PaginaEvolucaoAntiga({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const consulta = new URLSearchParams()
  for (const [chave, valor] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) consulta.append(chave, v)
  }
  const q = consulta.toString()
  redirect(`/internacoes/${id}${q ? `?${q}` : ''}#ficha`)
}
