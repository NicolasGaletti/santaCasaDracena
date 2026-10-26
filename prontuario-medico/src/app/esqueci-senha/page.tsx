'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CartaoAuth } from '@/components/layout/cartao-auth'
import { RotuloCampo } from '@/components/layout/rotulo-campo'
import { pedirLink, type EstadoEsqueci } from './actions'

const ESTADO_INICIAL: EstadoEsqueci = {}

export default function EsqueciSenhaPage() {
  const [state, formAction, pending] = useActionState(pedirLink, ESTADO_INICIAL)

  return (
    <CartaoAuth titulo="Esqueci minha senha" descricao="Informe seu e-mail profissional.">
      {state.enviado && (
        <p role="status" className="mb-4 rounded-lg border border-primary-suave-borda bg-primary-suave p-3 text-sm font-semibold text-primary-suave-foreground">
          Se o e-mail estiver cadastrado, enviaremos um link.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <RotuloCampo htmlFor="email">E-mail</RotuloCampo>
          <Input id="email" name="email" type="email" required />
        </div>
        <Button type="submit" variant="primaria" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Enviando...' : 'Enviar link'}
        </Button>
      </form>
      <p className="mt-3 text-center">
        <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
          Voltar ao login
        </Link>
      </p>
    </CartaoAuth>
  )
}
