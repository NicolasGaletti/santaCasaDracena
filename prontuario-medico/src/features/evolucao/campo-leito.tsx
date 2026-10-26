'use client'

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import { toast } from 'sonner'
import { trocarLeito } from './actions'
import { Input } from '@/components/ui/input'
import { RotuloCampo } from '@/components/layout/rotulo-campo'

const assinaVazio = () => () => {}

export function CampoLeito({
  internacaoId,
  leitoInicial,
  editavel,
  escuro = false,
}: {
  internacaoId: string
  leitoInicial: string
  editavel: boolean
  /** Sobre o cabeçalho escuro: rótulo claro. */
  escuro?: boolean
}) {
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
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <RotuloCampo htmlFor="leito-internacao" className={`mb-0 ${escuro ? 'text-cabecalho-suave' : ''}`}>
        Leito / ala
      </RotuloCampo>
      <Input
        id="leito-internacao"
        name="leito"
        value={valor}
        disabled={!editavel || !hidratado}
        onChange={(e) => {
          setErro(null)
          setValor(e.target.value)
        }}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? 'erro-leito' : undefined}
        className="w-full max-w-48 font-bold tabular-nums"
      />
      {enviando && (
        <p role="status" className={`text-sm font-semibold ${escuro ? 'text-cabecalho-suave' : 'text-muted-foreground'}`}>
          Salvando leito…
        </p>
      )}
      {erro && (
        <p id="erro-leito" role="alert" className={`text-sm font-semibold ${escuro ? 'text-rose-300' : 'text-destructive'}`}>
          {erro}
        </p>
      )}
    </div>
  )
}
