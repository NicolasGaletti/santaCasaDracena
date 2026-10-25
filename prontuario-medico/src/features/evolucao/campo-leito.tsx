'use client'

import { useState, useTransition } from 'react'
import { trocarLeito } from './actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CampoLeito({
  internacaoId,
  leitoInicial,
  editavel,
}: {
  internacaoId: string
  leitoInicial: string
  editavel: boolean
}) {
  const [valor, setValor] = useState(leitoInicial)
  const [salvo, setSalvo] = useState(leitoInicial)
  const [erro, setErro] = useState<string | null>(null)
  const [, startTransition] = useTransition()

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
      <Label htmlFor="leito-internacao" className="text-sm text-muted-foreground">
        Leito / ala
      </Label>
      <Input
        id="leito-internacao"
        name="leito"
        value={valor}
        disabled={!editavel}
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
        className="h-11 w-full max-w-40 text-lg font-bold tabular-nums"
      />
      {erro && (
        <p id="erro-leito" role="alert" className="text-sm font-semibold text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}
