'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { pedirLink, type EstadoEsqueci } from './actions'

const ESTADO_INICIAL: EstadoEsqueci = {}

export default function EsqueciSenhaPage() {
  const [state, formAction, pending] = useActionState(pedirLink, ESTADO_INICIAL)

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Esqueci minha senha</h1>
          <p className="text-sm text-slate-500">Informe seu e-mail profissional.</p>
        </div>

        {state.enviado && (
          <p role="status" className="mb-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-800">
            Se o e-mail estiver cadastrado, enviaremos um link.
          </p>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-600 uppercase mb-1">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg transition"
          >
            {pending ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-teal-700 hover:underline">Voltar ao login</Link>
        </p>
      </div>
    </div>
  )
}
