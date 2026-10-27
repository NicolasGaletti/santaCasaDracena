import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RotuloCampo } from '@/components/layout/rotulo-campo'
import { SubnavPilulas } from '@/components/layout/subnav-pilulas'
import type { LinhaAcesso, LinhaAlteracao, Pagina } from './consultas'
import {
  queryAuditoria,
  resumoDiff,
  rotuloAcao,
  rotuloOperacao,
  rotuloTabela,
  TAMANHO_PAGINA,
  type FiltrosAuditoria,
} from './funcoes'

const FORMATO = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
const quando = (iso: string) => FORMATO.format(new Date(iso))

const CLASSE_CELULA = 'px-3 py-2.5 align-top'
const CLASSE_CABECALHO = 'px-3 py-2 text-left text-[11px] font-bold tracking-wide text-texto-forte uppercase'

function Abas({ filtros }: { filtros: FiltrosAuditoria }) {
  const abas = [
    { aba: 'acessos', rotulo: 'Acessos' },
    { aba: 'alteracoes', rotulo: 'Alterações' },
  ] as const
  return (
    <SubnavPilulas
      rotuloNav="Seções da auditoria"
      itens={abas.map((a) => ({ href: queryAuditoria({ ...filtros, aba: a.aba, pagina: 1 }), rotulo: a.rotulo, ativo: filtros.aba === a.aba }))}
    />
  )
}

function Filtros({ filtros, profissionais }: { filtros: FiltrosAuditoria; profissionais: { id: string; nome: string }[] }) {
  const temFiltro = Boolean(filtros.de || filtros.ate || filtros.profissional)
  return (
    <form action="/auditoria" className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[auto_auto_minmax(0,1fr)_auto]">
      {filtros.aba === 'alteracoes' && <input type="hidden" name="aba" value="alteracoes" />}
      <div className="block">
        <RotuloCampo htmlFor="filtro-de">De</RotuloCampo>
        <Input id="filtro-de" name="de" type="date" defaultValue={filtros.de} />
      </div>
      <div className="block">
        <RotuloCampo htmlFor="filtro-ate">Até</RotuloCampo>
        <Input id="filtro-ate" name="ate" type="date" defaultValue={filtros.ate} />
      </div>
      <div className="col-span-2 block lg:col-span-1">
        <RotuloCampo htmlFor="filtro-profissional">Profissional</RotuloCampo>
        <select
          id="filtro-profissional"
          name="profissional"
          defaultValue={filtros.profissional ?? ''}
          className="h-11 w-full min-w-0 rounded-lg border border-input bg-campo px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        >
          <option value="">Todos os profissionais</option>
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2 flex gap-2 lg:col-span-1">
        <Button type="submit" variant="primaria" className="flex-1 lg:flex-none">
          Filtrar
        </Button>
        {temFiltro && (
          <Button asChild variant="outline" className="flex-1 lg:flex-none">
            <Link href={queryAuditoria({ aba: filtros.aba })}>Limpar</Link>
          </Button>
        )}
      </div>
    </form>
  )
}

function Paginacao({ filtros, total }: { filtros: FiltrosAuditoria; total: number }) {
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA))
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
      {filtros.pagina > 1 ? (
        <Button asChild variant="outline">
          <Link href={queryAuditoria({ ...filtros, pagina: filtros.pagina - 1 })} rel="prev">
            Anterior
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted-foreground tabular-nums">
        Página {filtros.pagina} de {paginas}
      </p>
      {filtros.pagina < paginas ? (
        <Button asChild variant="outline">
          <Link href={queryAuditoria({ ...filtros, pagina: filtros.pagina + 1 })} rel="next">
            Próxima
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  )
}

function Vazio() {
  return <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-muted-foreground">Nenhum registro neste filtro.</p>
}

function TabelaAcessos({ linhas }: { linhas: LinhaAcesso[] }) {
  if (linhas.length === 0) return <Vazio />
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[34rem] text-sm">
        <thead className="border-b border-border bg-muted">
          <tr>
            <th scope="col" className={CLASSE_CABECALHO}>Quando</th>
            <th scope="col" className={CLASSE_CABECALHO}>Profissional</th>
            <th scope="col" className={CLASSE_CABECALHO}>Paciente</th>
            <th scope="col" className={CLASSE_CABECALHO}>Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {linhas.map((l) => (
            <tr key={l.id}>
              <td className={`${CLASSE_CELULA} whitespace-nowrap tabular-nums`}>{quando(l.em)}</td>
              <td className={CLASSE_CELULA}>{l.profissional}</td>
              <td className={CLASSE_CELULA}>{l.paciente}</td>
              <td className={CLASSE_CELULA}>{rotuloAcao(l.acao)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabelaAlteracoes({ linhas }: { linhas: (LinhaAlteracao & { quem: string })[] }) {
  if (linhas.length === 0) return <Vazio />
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="border-b border-border bg-muted">
          <tr>
            <th scope="col" className={CLASSE_CABECALHO}>Quando</th>
            <th scope="col" className={CLASSE_CABECALHO}>Quem</th>
            <th scope="col" className={CLASSE_CABECALHO}>Tabela</th>
            <th scope="col" className={CLASSE_CABECALHO}>Operação</th>
            <th scope="col" className={CLASSE_CABECALHO}>Resumo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {linhas.map((l) => (
            <tr key={l.id}>
              <td className={`${CLASSE_CELULA} whitespace-nowrap tabular-nums`}>{quando(l.em)}</td>
              <td className={CLASSE_CELULA}>{l.quem}</td>
              <td className={CLASSE_CELULA}>{rotuloTabela(l.tabela)}</td>
              <td className={CLASSE_CELULA}>{rotuloOperacao(l.operacao)}</td>
              <td className={`${CLASSE_CELULA} wrap-break-word text-muted-foreground`}>{resumoDiff(l.operacao, l.antes, l.depois)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PainelAuditoria({
  filtros,
  profissionais,
  acessos,
  alteracoes,
}: {
  filtros: FiltrosAuditoria
  profissionais: { id: string; nome: string }[]
  acessos?: Pagina<LinhaAcesso>
  alteracoes?: Pagina<LinhaAlteracao & { quem: string }>
}) {
  const total = (filtros.aba === 'acessos' ? acessos?.total : alteracoes?.total) ?? 0
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h1 className="text-2xl font-bold">Auditoria</h1>
      <Abas filtros={filtros} />
      <Filtros filtros={filtros} profissionais={profissionais} />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total} {total === 1 ? 'registro' : 'registros'}
      </p>
      {filtros.aba === 'acessos' ? <TabelaAcessos linhas={acessos?.linhas ?? []} /> : <TabelaAlteracoes linhas={alteracoes?.linhas ?? []} />}
      <Paginacao filtros={filtros} total={total} />
    </div>
  )
}
