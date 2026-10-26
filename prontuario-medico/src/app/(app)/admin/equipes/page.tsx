import { listarEquipesAdmin, listarProfissionaisAdmin } from '@/features/admin/consultas'
import { ListaEquipes } from '@/features/admin/lista-equipes'
import { exigirAdmin } from '@/lib/auth'

export default async function PaginaEquipes() {
  await exigirAdmin()
  const [equipes, profissionais] = await Promise.all([listarEquipesAdmin(), listarProfissionaisAdmin()])
  return (
    <>
      <h1 className="text-2xl font-bold">Equipes</h1>
      <ListaEquipes equipes={equipes} profissionais={profissionais} />
    </>
  )
}
