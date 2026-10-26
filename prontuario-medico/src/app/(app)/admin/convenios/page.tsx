import { listarConveniosAdmin } from '@/features/admin/consultas'
import { ListaConvenios } from '@/features/admin/lista-convenios'
import { exigirAdmin } from '@/lib/auth'

export default async function PaginaConvenios() {
  await exigirAdmin()
  const convenios = await listarConveniosAdmin()
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Convênios</h1>
        <p className="text-sm text-muted-foreground">Só os convênios ativos aparecem na admissão, os mais usados primeiro.</p>
      </div>
      <ListaConvenios convenios={convenios} />
    </>
  )
}
