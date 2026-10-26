'use client'

import { useState, type ComponentProps, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { sairLimpando, sincronizarAntesDeSair } from './encerrar'
import { haCopiaNaoSincronizada } from './limpeza'

/**
 * "Sair" que envia o rascunho pendente e apaga as cópias locais já sincronizadas. Se algo não puder ser
 * enviado, pergunta antes: sair mesmo assim deixa essa cópia guardada no aparelho.
 */
export function BotaoSair({
  className,
  formClassName,
  variant = 'outline',
}: Pick<ComponentProps<typeof Button>, 'className' | 'variant'> & { formClassName?: string }) {
  const [ocupado, setOcupado] = useState(false)
  const [resultado, setResultado] = useState(false)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (ocupado) return
    setOcupado(true)
    try {
      await sincronizarAntesDeSair()
      // Decisão pelo que há no IndexedDB (qualquer aba/fila), não só pelas filas desta página.
      if (await haCopiaNaoSincronizada()) {
        setResultado(true)
        setOcupado(false)
        return
      }
      await sairLimpando()
    } catch {
      setOcupado(false)
    }
  }

  async function sairMesmoAssim() {
    if (!resultado || ocupado) return
    setOcupado(true)
    try {
      await sairLimpando()
    } catch {
      setOcupado(false)
    }
  }

  return (
    <>
      <form onSubmit={aoEnviar} className={formClassName}>
        <Button type="submit" variant={variant} className={className} disabled={ocupado}>
          Sair
        </Button>
      </form>
      <Dialog open={resultado} onOpenChange={(aberto) => !aberto && !ocupado && setResultado(false)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Há alterações que ainda não foram salvas no servidor.</DialogTitle>
            <DialogDescription>
              Se sair agora, a cópia fica guardada neste aparelho e será enviada quando você entrar de novo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={ocupado} onClick={sairMesmoAssim}>
              Sair mesmo assim
            </Button>
            <Button type="button" autoFocus disabled={ocupado} onClick={() => setResultado(false)}>
              Continuar editando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
