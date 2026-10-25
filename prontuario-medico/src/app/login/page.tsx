'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { entrar } from './actions'
import type { EstadoForm } from '@/lib/forms'

const ESTADO_INICIAL: EstadoForm & { email?: string } = {}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
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
      : ''
  const mensagemErro = state.erro ?? erroUrl

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Prontuário Eletrônico</h1>
          <p className="text-sm text-slate-500">Santa Casa - Acesso Restrito</p>
        </div>

        {mensagemErro && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {mensagemErro}
          </p>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={searchParams.get('next') ?? '/'} />
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-600 uppercase mb-1">E-mail Profissional</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={state.email}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800"
              placeholder="medico@santacasa.com.br"
            />
          </div>
          <div>
            <label htmlFor="senha" className="block text-xs font-semibold text-slate-600 uppercase mb-1">Senha</label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg transition"
          >
            {pending ? 'Acessando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}
