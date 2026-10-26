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
import type { ResultadoFilas } from './limpeza'

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
  const [resultado, setResultado] = useState<ResultadoFilas | null>(null)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (ocupado) return
    setOcupado(true)
    try {
      const r = await sincronizarAntesDeSair()
      if (r.naoSalvas.length > 0) {
        setResultado(r)
        setOcupado(false)
        return
      }
      await sairLimpando(r)
    } catch {
      setOcupado(false)
    }
  }

  async function sairMesmoAssim() {
    if (!resultado || ocupado) return
    setOcupado(true)
    try {
      await sairLimpando(resultado)
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
      <Dialog open={resultado !== null} onOpenChange={(aberto) => !aberto && !ocupado && setResultado(null)}>
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
            <Button type="button" autoFocus disabled={ocupado} onClick={() => setResultado(null)}>
              Continuar editando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
