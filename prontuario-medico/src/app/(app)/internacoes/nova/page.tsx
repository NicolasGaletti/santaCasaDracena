import { redirect } from 'next/navigation'
import { FormAdmissao } from '@/features/internacoes/form-admissao'
import { listarEquipes } from '@/features/internacoes/consultas'
import { exigirNaoAdmin } from '@/lib/auth'

export default async function PaginaAdmissao() {
  const profissional = await exigirNaoAdmin()
  if (profissional.perfil !== 'medico' && profissional.perfil !== 'recepcao') redirect('/')

  const equipes = await listarEquipes()

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Admitir paciente</h1>
        <p className="text-sm text-muted-foreground">
          Campos com * são obrigatórios.
        </p>
      </div>
      <FormAdmissao equipes={equipes} />
    </>
  )
}
