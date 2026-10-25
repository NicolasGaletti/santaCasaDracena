import { redirect } from 'next/navigation'
import { FormAdmissao } from '@/features/internacoes/form-admissao'
import { listarEquipes, listarMedicos } from '@/features/internacoes/consultas'
import { exigirProfissional } from '@/lib/auth'

export default async function PaginaAdmissao() {
  const profissional = await exigirProfissional()
  if (profissional.perfil !== 'medico' && profissional.perfil !== 'recepcao') redirect('/')

  const [equipes, medicos] = await Promise.all([listarEquipes(), listarMedicos()])

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Admitir paciente</h1>
        <p className="text-sm text-muted-foreground">
          Campos com * são obrigatórios.
        </p>
      </div>
      <FormAdmissao equipes={equipes} medicos={medicos} />
    </>
  )
}
