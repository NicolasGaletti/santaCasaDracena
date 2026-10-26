'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CartaoAuth } from '@/components/layout/cartao-auth'
import { RotuloCampo } from '@/components/layout/rotulo-campo'
import { definirSenha } from './actions'
import type { EstadoForm } from '@/lib/forms'
import { validarSenha } from '@/lib/senha'

const ESTADO_INICIAL: EstadoForm = {}

export function FormSenha() {
  const [state, formAction, pending] = useActionState(definirSenha, ESTADO_INICIAL)
  const [erroLocal, setErroLocal] = useState<string | null>(null)
  const erro = erroLocal ?? state.erro

  return (
    <CartaoAuth titulo="Definir senha" descricao="Mínimo de 10 caracteres, com letra e número.">
      {erro && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive-soft-borda bg-destructive-soft p-3 text-sm font-semibold text-destructive-soft-foreground">
          {erro}
        </p>
      )}

      <form
        action={formAction}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          const dados = new FormData(e.currentTarget)
          const invalida = validarSenha(String(dados.get('senha') ?? ''))
          setErroLocal(invalida)
          if (invalida) e.preventDefault()
        }}
      >
        <div>
          <RotuloCampo htmlFor="senha">Nova senha</RotuloCampo>
          <Input id="senha" name="senha" type="password" required autoComplete="new-password" />
        </div>
        <div>
          <RotuloCampo htmlFor="confirmacao">Confirmar nova senha</RotuloCampo>
          <Input id="confirmacao" name="confirmacao" type="password" required autoComplete="new-password" />
        </div>
        <Button type="submit" variant="primaria" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Salvando...' : 'Salvar senha'}
        </Button>
      </form>
    </CartaoAuth>
  )
}
