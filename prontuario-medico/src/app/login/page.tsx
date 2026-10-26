'use client'

import { Suspense, useActionState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { entrar } from './actions'
import type { EstadoForm } from '@/lib/forms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CartaoAuth } from '@/components/layout/cartao-auth'
import { RotuloCampo } from '@/components/layout/rotulo-campo'

const ESTADO_INICIAL: EstadoForm & { email?: string } = {}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const [state, formAction, pending] = useActionState(entrar, ESTADO_INICIAL)
  const erroUrl =
    searchParams.get('error') === 'sem_cadastro'
      ? 'Seu usuário não tem cadastro profissional ativo. Procure o administrador.'
      : searchParams.get('error') === 'link_invalido'
        ? 'Link inválido ou expirado. Peça um novo convite ou use "Esqueci minha senha".'
        : searchParams.get('motivo') === 'inatividade'
          ? 'Sua sessão expirou por inatividade.'
          : ''
  const mensagemErro = state.erro ?? erroUrl
  const rascunhoPendente = searchParams.get('pendente') === '1'

  return (
    <CartaoAuth titulo="Entrar" descricao="Acesso restrito aos profissionais da Santa Casa.">
      {mensagemErro && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive-soft-borda bg-destructive-soft p-3 text-sm font-semibold text-destructive-soft-foreground">
          {mensagemErro}
        </p>
      )}

      {rascunhoPendente && (
        <p role="status" className="mb-4 rounded-lg border border-status-rascunho-borda bg-status-rascunho-bg p-3 text-sm text-status-rascunho-fg">
          Um rascunho não sincronizado ficou guardado neste aparelho e será enviado quando você entrar de novo.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={searchParams.get('next') ?? '/'} />
        <div>
          <RotuloCampo htmlFor="email">E-mail Profissional</RotuloCampo>
          <Input id="email" name="email" type="email" required defaultValue={state.email} placeholder="medico@santacasa.com.br" />
        </div>
        <div>
          <RotuloCampo htmlFor="senha">Senha</RotuloCampo>
          <Input id="senha" name="senha" type="password" required placeholder="••••••••" />
        </div>
        <Button type="submit" variant="primaria" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Acessando...' : 'Entrar no Sistema'}
        </Button>
      </form>
      <p className="mt-3 text-center">
        <Link href="/esqueci-senha" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
          Esqueci minha senha
        </Link>
      </p>
    </CartaoAuth>
  )
}
