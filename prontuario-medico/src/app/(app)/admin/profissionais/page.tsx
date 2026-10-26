import { listarEquipesAdmin, listarProfissionaisAdmin } from '@/features/admin/consultas'
import { ListaProfissionais } from '@/features/admin/lista-profissionais'
import { exigirAdmin } from '@/lib/auth'

export default async function PaginaProfissionais() {
  const admin = await exigirAdmin()
  const [profissionais, equipes] = await Promise.all([listarProfissionaisAdmin(), listarEquipesAdmin()])
  return (
    <>
      <h1 className="text-2xl font-bold">Profissionais</h1>
      <ListaProfissionais profissionais={profissionais} equipes={equipes} meuId={admin.id} />
    </>
  )
}
