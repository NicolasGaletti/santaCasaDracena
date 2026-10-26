'use client'

import { useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { darAlta } from './actions'
import { agoraLocalSP, localSPParaIso } from './data-hora'
import { ROTULO_TIPO_ALTA, TIPOS_ALTA, type TipoAlta } from './tipos'

const MENSAGEM_GENERICA = 'Não foi possível dar a alta. Tente novamente.'
const LIMITE_RESUMO = 2000

/** Botão "Dar alta" e o diálogo com tipo, resumo e data/hora. A confirmação final fica no próprio diálogo. */
export function DialogAlta({ internacaoId }: { internacaoId: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState<TipoAlta | null>(null)
  const [resumo, setResumo] = useState('')
  const [padrao, setPadrao] = useState(() => agoraLocalSP())
  const [dataHora, setDataHora] = useState(padrao)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Trava síncrona: dois toques no mesmo instante não enviam duas altas.
  const travado = useRef(false)

  function mudarAberto(proximo: boolean) {
    if (enviando) return
    setAberto(proximo)
    if (proximo) {
      const agora = agoraLocalSP()
      setPadrao(agora)
      setDataHora(agora)
      setTipo(null)
      setResumo('')
      setErro(null)
    }
  }

  async function confirmar() {
    if (travado.current) return
    if (!tipo) return setErro('Informe o tipo da alta.')
    if (resumo.trim() === '') return setErro('Informe o resumo da alta.')
    // Data/hora intocada = agora (no servidor), para não cair antes de uma evolução recém-finalizada.
    const altaEm = dataHora === padrao ? null : localSPParaIso(dataHora)
    if (dataHora !== padrao && !altaEm) return setErro('Informe uma data e hora válidas.')

    travado.current = true
    setEnviando(true)
    setErro(null)
    try {
      const resultado = await darAlta(internacaoId, { tipo, resumo, altaEm })
      if (resultado.erro) {
        setErro(resultado.erro)
        return
      }
      setAberto(false)
      router.refresh()
    } catch {
      setErro(MENSAGEM_GENERICA)
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogTrigger asChild>
        <Button type="button" size="compacto" variant="alta">
          <LogOut aria-hidden />
          Dar alta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dar alta</DialogTitle>
          <DialogDescription>Depois da alta, a internação fica somente leitura.</DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Tipo da alta</legend>
          <div role="radiogroup" aria-label="Tipo da alta" className="grid grid-cols-2 gap-2">
            {TIPOS_ALTA.map((t) => (
              <label
                key={t}
                className="relative flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-input bg-card px-3 text-sm font-semibold transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
              >
                <input
                  type="radio"
                  name="tipo-alta"
                  value={t}
                  checked={tipo === t}
                  onChange={() => setTipo(t)}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
                {ROTULO_TIPO_ALTA[t]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="resumo-alta">Resumo da alta</Label>
          <Textarea
            id="resumo-alta"
            value={resumo}
            maxLength={LIMITE_RESUMO}
            rows={4}
            onChange={(e) => setResumo(e.target.value)}
          />
          <p className="text-xs text-muted-foreground tabular-nums">
            {resumo.length} de {LIMITE_RESUMO}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="data-alta">Data e hora da alta</Label>
          <Input
            id="data-alta"
            type="datetime-local"
            value={dataHora}
            max={padrao}
            onChange={(e) => setDataHora(e.target.value)}
          />
        </div>

        {erro && (
          <p role="alert" className="rounded-lg bg-destructive-soft p-3 text-sm font-semibold text-destructive-soft-foreground">
            {erro}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" size="lg" disabled={enviando} onClick={() => mudarAberto(false)}>
            Cancelar
          </Button>
          <Button type="button" size="lg" disabled={enviando} onClick={confirmar}>
            Confirmar alta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
