import { listarAcessos, listarAlteracoes, listarProfissionaisFiltro } from '@/features/auditoria/consultas'
import { lerFiltros } from '@/features/auditoria/funcoes'
import { PainelAuditoria } from '@/features/auditoria/painel-auditoria'
import { exigirAuditoria } from '@/lib/auth'

export default async function PaginaAuditoria({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await exigirAuditoria()
  const filtros = lerFiltros(await searchParams)
  const [profissionais, acessos, alteracoes] = await Promise.all([
    listarProfissionaisFiltro(),
    filtros.aba === 'acessos' ? listarAcessos(filtros) : undefined,
    filtros.aba === 'alteracoes' ? listarAlteracoes(filtros) : undefined,
  ])
  return <PainelAuditoria filtros={filtros} profissionais={profissionais} acessos={acessos} alteracoes={alteracoes} />
}
