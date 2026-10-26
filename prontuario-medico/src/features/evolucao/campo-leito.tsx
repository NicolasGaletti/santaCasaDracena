'use client'

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import { toast } from 'sonner'
import { trocarLeito } from './actions'
import { BedDouble, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RotuloCampo } from '@/components/layout/rotulo-campo'

const assinaVazio = () => () => {}

export function CampoLeito({
  internacaoId,
  leitoInicial,
  editavel,
}: {
  internacaoId: string
  leitoInicial: string
  editavel: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [valor, setValor] = useState(leitoInicial)
  const [salvo, setSalvo] = useState(leitoInicial)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, startTransition] = useTransition()
  // Bloqueado no HTML do servidor: digitação antes da hidratação não chegaria ao estado.
  const hidratado = useSyncExternalStore(assinaVazio, () => true, () => false)

  // Sem este aviso, fechar ou recarregar com a troca em voo perde a gravação.
  useEffect(() => {
    if (!enviando) return
    function aoSair(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', aoSair)
    return () => window.removeEventListener('beforeunload', aoSair)
  }, [enviando])

  function confirmar() {
    const novo = valor.trim()
    if (novo === '') {
      setErro('Informe o leito.')
      setValor(salvo)
      return
    }
    if (novo === salvo) {
      setValor(salvo)
      setAberto(false)
      return
    }
    startTransition(async () => {
      const resultado = await trocarLeito(internacaoId, novo)
      if (resultado.erro) {
        setErro(resultado.erro)
        toast.error(resultado.erro)
        setValor(salvo)
        return
      }
      setErro(null)
      setSalvo(novo)
      setValor(novo)
      setAberto(false)
    })
  }

  function mudarAberto(proximo: boolean) {
    if (enviando) return
    setAberto(proximo)
    if (proximo) {
      setValor(salvo)
      setErro(null)
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1 text-[13px] text-cabecalho-suave">
      <BedDouble aria-hidden className="size-4 shrink-0" />
      <span data-slot="leito-texto" className="min-w-0 truncate font-semibold text-white tabular-nums">
        {salvo}
      </span>
      {editavel && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Trocar leito"
          disabled={!hidratado}
          onClick={() => mudarAberto(true)}
          className="size-11 text-cabecalho-suave hover:bg-white/10 hover:text-white sm:size-9"
        >
          <Pencil aria-hidden className="size-4" />
        </Button>
      )}
      <Dialog open={aberto} onOpenChange={mudarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar leito</DialogTitle>
            <DialogDescription>Informe o novo leito ou ala do paciente.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1 text-foreground">
            <RotuloCampo htmlFor="leito-internacao" className="mb-0">
              Leito / ala
            </RotuloCampo>
            <Input
              id="leito-internacao"
              name="leito"
              value={valor}
              onChange={(e) => {
                setErro(null)
                setValor(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  confirmar()
                }
              }}
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? 'erro-leito' : undefined}
              className="w-full font-bold tabular-nums"
            />
            {enviando && (
              <p role="status" className="text-sm font-semibold text-muted-foreground">
                Salvando leito…
              </p>
            )}
            {erro && (
              <p id="erro-leito" role="alert" className="text-sm font-semibold text-destructive">
                {erro}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={enviando} onClick={() => mudarAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" size="lg" disabled={enviando} onClick={confirmar}>
              Salvar leito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
