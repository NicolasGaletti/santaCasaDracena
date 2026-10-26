import type { ReactNode } from 'react'
import { RodapeAcoes } from '@/components/layout/rodape-acoes'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Rodapé da ficha: status do salvamento e ações (secundária, Salvar e principal do perfil). */
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
    <div className="sm:overflow-hidden sm:rounded-b-xl sm:border sm:border-t-0 sm:border-border">
      <RodapeAcoes
        espaco={false}
        info={
          <p role="status" aria-live="polite" className="font-semibold">
            {indicador}
          </p>
        }
      >
        {acaoSecundaria}
        <Button type="button" variant="suave" size="lg" className="sm:h-9 sm:px-3 sm:text-[13px]" disabled={salvar.desabilitado} onClick={salvar.onSalvar}>
          Salvar
        </Button>
        {acaoPrincipal}
      </RodapeAcoes>
    </div>
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
