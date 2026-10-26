import { redirect } from 'next/navigation'
import { FormAdmissao } from '@/features/internacoes/form-admissao'
import { listarConveniosDaLista, listarEquipes } from '@/features/internacoes/consultas'
import { exigirNaoAdmin } from '@/lib/auth'

export default async function PaginaAdmissao() {
  const profissional = await exigirNaoAdmin()
  if (profissional.perfil !== 'medico' && profissional.perfil !== 'recepcao') redirect('/')

  const [equipes, convenios] = await Promise.all([listarEquipes(), listarConveniosDaLista()])

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Admitir paciente</h1>
        <p className="text-sm text-muted-foreground">Preencha os dados para abrir o prontuário.</p>
      </div>
      <FormAdmissao equipes={equipes} convenios={convenios} />
    </>
  )
}
