'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RotuloCampo } from '@/components/layout/rotulo-campo'
import { alterarAtivo, atualizarProfissional, convidarProfissional, reenviarConvite } from './actions'
import { FormProfissional, type ValoresProfissional } from './form-profissional'
import { funcaoDe } from './funcoes'
import type { EquipeAdmin, ProfissionalAdmin } from './consultas'

type Props = { profissionais: ProfissionalAdmin[]; equipes: EquipeAdmin[]; meuId: string }

type Dialogo =
  | { tipo: 'convidar' }
  | { tipo: 'editar'; alvo: ProfissionalAdmin }
  | { tipo: 'ativo'; alvo: ProfissionalAdmin; ativar: boolean }
  | null

const VAZIO: ValoresProfissional = { nome: '', email: '', funcao: '', conselho: '', numero: '', uf: '', equipeIds: [] }

function status(p: ProfissionalAdmin): { texto: string; classe: string } {
  if (!p.ativo) return { texto: 'Desativado', classe: 'bg-status-nenhum-bg text-status-nenhum-fg' }
  if (p.convite_pendente) return { texto: 'Convite pendente', classe: 'bg-status-rascunho-bg text-status-rascunho-fg' }
  return { texto: 'Ativo', classe: 'bg-status-feito-bg text-status-feito-fg' }
}

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function ListaProfissionais({ profissionais, equipes, meuId }: Props) {
  const [busca, setBusca] = useState('')
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const travado = useRef(false)

  const equipesAtivas = useMemo(() => equipes.filter((e) => e.ativo), [equipes])
  const nomeEquipe = useMemo(() => new Map(equipes.map((e) => [e.id, e.nome])), [equipes])
  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim())
    if (!termo) return profissionais
    return profissionais.filter((p) => normalizar(`${p.nome} ${p.email ?? ''}`).includes(termo))
  }, [profissionais, busca])

  function abrir(d: Dialogo) {
    setErro(null)
    setDialogo(d)
  }

  async function executar(fn: () => Promise<{ erro?: string }>, sucesso?: string) {
    if (travado.current) return
    travado.current = true
    setEnviando(true)
    setErro(null)
    try {
      const r = await fn()
      if (r.erro) return setErro(r.erro)
      setDialogo(null)
      if (sucesso) toast.success(sucesso)
    } catch {
      setErro('Não foi possível concluir a operação. Tente novamente.')
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  async function reenviar(p: ProfissionalAdmin) {
    try {
      const r = await reenviarConvite(p.id)
      if (r.erro) toast.error(r.erro)
      else toast.success('Convite reenviado.')
    } catch {
      toast.error('Não foi possível reenviar o convite. Tente novamente.')
    }
  }

  const alvoAtivo = dialogo?.tipo === 'ativo' ? dialogo : null
  const alvoEditar = dialogo?.tipo === 'editar' ? dialogo.alvo : null

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:w-80">
          <RotuloCampo htmlFor="busca-prof">Buscar profissional</RotuloCampo>
          <Input
            id="busca-prof"
            type="search"
            value={busca}
            placeholder="Nome ou e-mail"
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Button type="button" variant="primaria" size="lg" className="w-full sm:w-auto" onClick={() => abrir({ tipo: 'convidar' })}>
          Convidar profissional
        </Button>
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-muted-foreground">
          Nenhum profissional encontrado.
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visiveis.map((p) => {
            const s = status(p)
            const funcao = funcaoDe(p.perfil, p.categoria)
            const registro = p.conselho && p.numero_conselho ? `${p.conselho} ${p.numero_conselho}${p.uf_conselho ? `/${p.uf_conselho}` : ''}` : null
            const nomesEquipes = p.equipe_ids.map((id) => nomeEquipe.get(id)).filter(Boolean)
            return (
              <li key={p.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-bold leading-snug">{p.nome}</h2>
                    <p className="break-all text-sm text-muted-foreground">{p.email}</p>
                  </div>
                  <Badge className={`shrink-0 px-2 text-xs ${s.classe}`}>{s.texto}</Badge>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Função</dt>
                  <dd className="font-semibold">{funcao?.rotulo ?? p.perfil}</dd>
                  {registro && (
                    <>
                      <dt className="text-muted-foreground">Conselho</dt>
                      <dd className="font-semibold tabular-nums">{registro}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Equipes</dt>
                  <dd className="font-semibold">{nomesEquipes.length > 0 ? nomesEquipes.join(', ') : 'Nenhuma'}</dd>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => abrir({ tipo: 'editar', alvo: p })}>
                    Editar
                  </Button>
                  {p.ativo && p.convite_pendente && (
                    <Button type="button" variant="outline" onClick={() => reenviar(p)}>
                      Reenviar convite
                    </Button>
                  )}
                  {p.id !== meuId &&
                    (p.ativo ? (
                      <Button type="button" variant="destructive" onClick={() => abrir({ tipo: 'ativo', alvo: p, ativar: false })}>
                        Desativar
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" onClick={() => abrir({ tipo: 'ativo', alvo: p, ativar: true })}>
                        Reativar
                      </Button>
                    ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={dialogo?.tipo === 'convidar'} onOpenChange={(a) => !a && !enviando && setDialogo(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convidar profissional</DialogTitle>
            <DialogDescription>A pessoa recebe um e-mail para definir a senha.</DialogDescription>
          </DialogHeader>
          {dialogo?.tipo === 'convidar' && (
            <FormProfissional
              modo="convidar"
              equipes={equipesAtivas}
              inicial={VAZIO}
              enviando={enviando}
              erro={erro}
              rotuloEnvio="Enviar convite"
              onCancelar={() => setDialogo(null)}
              onEnviar={(v) => executar(() => convidarProfissional(v), 'Convite enviado.')}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={alvoEditar !== null} onOpenChange={(a) => !a && !enviando && setDialogo(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar profissional</DialogTitle>
            <DialogDescription>{alvoEditar?.email}</DialogDescription>
          </DialogHeader>
          {alvoEditar && (
            <FormProfissional
              modo="editar"
              equipes={equipesAtivas}
              funcaoTravada={alvoEditar.id === meuId}
              inicial={{
                nome: alvoEditar.nome,
                email: alvoEditar.email ?? '',
                funcao: funcaoDe(alvoEditar.perfil, alvoEditar.categoria)?.valor ?? '',
                conselho: alvoEditar.conselho ?? '',
                numero: alvoEditar.numero_conselho ?? '',
                uf: alvoEditar.uf_conselho ?? '',
                equipeIds: alvoEditar.equipe_ids,
              }}
              enviando={enviando}
              erro={erro}
              rotuloEnvio="Salvar"
              onCancelar={() => setDialogo(null)}
              onEnviar={(v) => executar(() => atualizarProfissional(alvoEditar.id, v, alvoEditar.equipe_ids), 'Profissional atualizado.')}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={alvoAtivo !== null} onOpenChange={(a) => !a && !enviando && setDialogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{alvoAtivo?.ativar ? 'Reativar profissional' : 'Desativar profissional'}</DialogTitle>
            <DialogDescription>
              {alvoAtivo?.ativar
                ? `${alvoAtivo.alvo.nome} volta a poder entrar no sistema.`
                : `${alvoAtivo?.alvo.nome} perde o acesso agora e as sessões abertas são encerradas. Os registros dessa pessoa são mantidos.`}
            </DialogDescription>
          </DialogHeader>
          {erro && (
            <p role="alert" className="rounded-lg bg-destructive-soft p-3 text-sm font-semibold text-destructive-soft-foreground">
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={enviando} onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="lg"
              variant={alvoAtivo?.ativar ? 'primaria' : 'destructive'}
              disabled={enviando}
              onClick={() => alvoAtivo && executar(() => alterarAtivo(alvoAtivo.alvo.id, alvoAtivo.ativar), alvoAtivo.ativar ? 'Profissional reativado.' : 'Profissional desativado.')}
            >
              {alvoAtivo?.ativar ? 'Confirmar reativação' : 'Confirmar desativação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
