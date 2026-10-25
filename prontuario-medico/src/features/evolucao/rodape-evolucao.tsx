import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Rodapé fixo das evoluções: status, Salvar e, à direita, ações do perfil (secundária e principal). */
export function RodapeEvolucao({
  indicador,
  acaoSecundaria,
  salvar,
  acaoPrincipal,
}: {
  indicador: string
  acaoSecundaria?: ReactNode
  salvar: { desabilitado: boolean; onSalvar: () => void }
  acaoPrincipal?: ReactNode
}) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-border bg-card px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:inset-x-0 lg:mx-auto lg:w-full lg:max-w-6xl">
      <p role="status" aria-live="polite" className="min-w-0 shrink text-xs font-semibold text-muted-foreground">
        {indicador}
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {acaoSecundaria}
        <Button type="button" variant="secondary" disabled={salvar.desabilitado} onClick={salvar.onSalvar} className="h-11 px-3 text-sm">
          Salvar
        </Button>
        {acaoPrincipal}
      </div>
    </footer>
  )
}

export function DialogoDescartar({
  aberto,
  enviando,
  onAbertoChange,
  onConfirmar,
}: {
  aberto: boolean
  enviando: boolean
  onAbertoChange: (aberto: boolean) => void
  onConfirmar: () => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={(a) => !enviando && onAbertoChange(a)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar rascunho?</DialogTitle>
          <DialogDescription>O rascunho será apagado e não poderá ser recuperado.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" size="lg" disabled={enviando} onClick={() => onAbertoChange(false)}>
            Manter rascunho
          </Button>
          <Button type="button" variant="destructive" size="lg" disabled={enviando} onClick={onConfirmar}>
            Descartar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
