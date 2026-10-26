'use client'

import { useActionState, useState } from 'react'
import { definirSenha } from './actions'
import type { EstadoForm } from '@/lib/forms'
import { validarSenha } from '@/lib/senha'

const ESTADO_INICIAL: EstadoForm = {}

export function FormSenha() {
  const [state, formAction, pending] = useActionState(definirSenha, ESTADO_INICIAL)
  const [erroLocal, setErroLocal] = useState<string | null>(null)
  const erro = erroLocal ?? state.erro

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Definir senha</h1>
          <p className="text-sm text-slate-500">Mínimo de 10 caracteres, com letra e número.</p>
        </div>

        {erro && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </p>
        )}

        <form
          action={formAction}
          className="space-y-4"
          onSubmit={(e) => {
            const dados = new FormData(e.currentTarget)
            const invalida = validarSenha(String(dados.get('senha') ?? ''))
            setErroLocal(invalida)
            if (invalida) e.preventDefault()
          }}
        >
          <div>
            <label htmlFor="senha" className="block text-xs font-semibold text-slate-600 uppercase mb-1">Nova senha</label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800"
            />
          </div>
          <div>
            <label htmlFor="confirmacao" className="block text-xs font-semibold text-slate-600 uppercase mb-1">Confirmar nova senha</label>
            <input
              id="confirmacao"
              name="confirmacao"
              type="password"
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg transition"
          >
            {pending ? 'Salvando...' : 'Salvar senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
