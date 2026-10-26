'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { salvarEquipe, vincularMembro } from './actions'
import type { EquipeAdmin, ProfissionalAdmin } from './consultas'

type Props = { equipes: EquipeAdmin[]; profissionais: ProfissionalAdmin[] }
type Dialogo = { tipo: 'nova' } | { tipo: 'renomear'; alvo: EquipeAdmin } | null

export function ListaEquipes({ equipes, profissionais }: Props) {
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const travado = useRef(false)

  function abrir(d: Dialogo) {
    setErro(null)
    setNome(d?.tipo === 'renomear' ? d.alvo.nome : '')
    setDialogo(d)
  }

  async function executar(fn: () => Promise<{ erro?: string }>, aoConcluir?: () => void): Promise<boolean> {
    if (travado.current) return false
    travado.current = true
    setEnviando(true)
    setErro(null)
    try {
      const r = await fn()
      if (r.erro) {
        setErro(r.erro)
        return false
      }
      aoConcluir?.()
      return true
    } catch {
      setErro('Não foi possível concluir a operação. Tente novamente.')
      return false
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  async function acaoRapida(fn: () => Promise<{ erro?: string }>) {
    try {
      const r = await fn()
      if (r.erro) toast.error(r.erro)
    } catch {
      toast.error('Não foi possível concluir a operação. Tente novamente.')
    }
  }

  function alternar(id: string) {
    setAbertas((atual) => {
      const novo = new Set(atual)
      if (!novo.delete(id)) novo.add(id)
      return novo
    })
  }

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" size="lg" className="w-full sm:w-auto" onClick={() => abrir({ tipo: 'nova' })}>
          Nova equipe
        </Button>
      </div>

      {equipes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
          Nenhuma equipe ainda. Crie a primeira para vincular profissionais.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {equipes.map((eq) => {
            const membros = profissionais.filter((p) => p.equipe_ids.includes(eq.id))
            const candidatos = profissionais.filter((p) => p.ativo && !p.equipe_ids.includes(eq.id))
            const aberta = abertas.has(eq.id)
            return (
              <li key={eq.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-bold leading-snug">{eq.nome}</h2>
                    <p className="text-sm text-muted-foreground">
                      {membros.length} {membros.length === 1 ? 'membro' : 'membros'}
                    </p>
                  </div>
                  <Badge
                    className={`shrink-0 px-2 text-xs ${eq.ativo ? 'bg-status-feito-bg text-status-feito-fg' : 'bg-status-nenhum-bg text-status-nenhum-fg'}`}
                  >
                    {eq.ativo ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" aria-expanded={aberta} onClick={() => alternar(eq.id)}>
                    Membros
                  </Button>
                  <Button type="button" variant="outline" onClick={() => abrir({ tipo: 'renomear', alvo: eq })}>
                    Renomear
                  </Button>
                  <Button
                    type="button"
                    variant={eq.ativo ? 'destructive' : 'outline'}
                    onClick={() => acaoRapida(() => salvarEquipe(eq.id, eq.nome, !eq.ativo))}
                  >
                    {eq.ativo ? 'Desativar' : 'Reativar'}
                  </Button>
                </div>

                {aberta && (
                  <div className="flex flex-col gap-3 border-t border-border pt-3">
                    {membros.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum membro nesta equipe.</p>
                    ) : (
                      <ul aria-label="Membros" className="flex flex-col gap-2">
                        {membros.map((m) => (
                          <li key={m.id} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                            <span className={`min-w-0 break-words font-semibold ${m.ativo ? '' : 'text-muted-foreground line-through'}`}>
                              {m.nome}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              aria-label={`Remover ${m.nome}`}
                              onClick={() => acaoRapida(() => vincularMembro(m.id, eq.id, false))}
                            >
                              Remover
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {candidatos.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`add-${eq.id}`}>Adicionar membro</Label>
                        <Select value="" onValueChange={(id) => acaoRapida(() => vincularMembro(id, eq.id, true))}>
                          <SelectTrigger id={`add-${eq.id}`} className="w-full">
                            <SelectValue placeholder="Selecione um profissional" />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            {candidatos.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="min-h-11">
                                {c.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={dialogo !== null} onOpenChange={(a) => !a && !enviando && setDialogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogo?.tipo === 'renomear' ? 'Renomear equipe' : 'Nova equipe'}</DialogTitle>
            <DialogDescription>O nome aparece na admissão e nos filtros de internados.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!dialogo) return
              const id = dialogo.tipo === 'renomear' ? dialogo.alvo.id : null
              const ativo = dialogo.tipo === 'renomear' ? null : true
              void executar(() => salvarEquipe(id, nome, ativo), () => setDialogo(null))
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="equipe-nome">Nome da equipe</Label>
              <Input id="equipe-nome" value={nome} maxLength={100} onChange={(e) => setNome(e.target.value)} required />
            </div>
            {erro && (
              <p role="alert" className="rounded-lg bg-destructive-soft p-3 text-sm font-semibold text-destructive-soft-foreground">
                {erro}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="lg" disabled={enviando} onClick={() => setDialogo(null)}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={enviando}>
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
