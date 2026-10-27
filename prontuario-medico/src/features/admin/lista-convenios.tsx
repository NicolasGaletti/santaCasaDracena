'use client'

import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RotuloCampo } from '@/components/layout/rotulo-campo'
import { salvarConvenio } from './actions'
import type { ConvenioAdmin } from './consultas'

type Dialogo = { tipo: 'novo' } | { tipo: 'renomear'; alvo: ConvenioAdmin } | null

export function ListaConvenios({ convenios }: { convenios: ConvenioAdmin[] }) {
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const travado = useRef(false)

  function abrir(d: Dialogo) {
    setErro(null)
    setNome(d?.tipo === 'renomear' ? d.alvo.nome : '')
    setDialogo(d)
  }

  async function enviar() {
    if (!dialogo || travado.current) return
    travado.current = true
    setEnviando(true)
    setErro(null)
    try {
      const id = dialogo.tipo === 'renomear' ? dialogo.alvo.id : null
      const r = await salvarConvenio(id, nome, dialogo.tipo === 'renomear' ? null : true)
      if (r.erro) setErro(r.erro)
      else setDialogo(null)
    } catch {
      setErro('Não foi possível concluir a operação. Tente novamente.')
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  async function alternar(c: ConvenioAdmin) {
    try {
      const r = await salvarConvenio(c.id, c.nome, !c.ativo)
      if (r.erro) toast.error(r.erro)
    } catch {
      toast.error('Não foi possível concluir a operação. Tente novamente.')
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" variant="primaria" size="lg" className="w-full sm:w-auto" onClick={() => abrir({ tipo: 'novo' })}>
          <Plus aria-hidden className="size-4" />
          Novo convênio
        </Button>
      </div>

      {convenios.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
          Nenhum convênio ainda. Cadastre o primeiro para liberá-lo na admissão.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {convenios.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start justify-between gap-3 sm:flex-1">
                <div className="min-w-0">
                  <h2 className={`wrap-break-word text-base leading-snug font-bold ${c.ativo ? '' : 'text-muted-foreground'}`}>{c.nome}</h2>
                  <p className="text-sm text-muted-foreground">
                    {c.usos} {c.usos === 1 ? 'uso' : 'usos'}
                  </p>
                </div>
                <Badge
                  className={`shrink-0 px-2 text-xs ${c.ativo ? 'bg-status-feito-bg text-status-feito-fg' : 'bg-status-nenhum-bg text-status-nenhum-fg'}`}
                >
                  {c.ativo ? 'Ativo' : 'Desativado'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => abrir({ tipo: 'renomear', alvo: c })}>
                  Renomear
                </Button>
                <Button type="button" variant={c.ativo ? 'destructive' : 'outline'} onClick={() => alternar(c)}>
                  {c.ativo ? 'Desativar' : 'Reativar'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogo !== null} onOpenChange={(a) => !a && !enviando && setDialogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogo?.tipo === 'renomear' ? 'Renomear convênio' : 'Novo convênio'}</DialogTitle>
            <DialogDescription>
              {dialogo?.tipo === 'renomear'
                ? 'Pacientes já admitidos mantêm o nome que foi gravado na admissão.'
                : 'O convênio fica disponível na lista da admissão.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void enviar()
            }}
          >
            <div>
              <RotuloCampo htmlFor="convenio-nome">Nome do convênio</RotuloCampo>
              <Input id="convenio-nome" value={nome} maxLength={100} onChange={(e) => setNome(e.target.value)} required />
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
              <Button type="submit" variant="primaria" size="lg" disabled={enviando}>
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
