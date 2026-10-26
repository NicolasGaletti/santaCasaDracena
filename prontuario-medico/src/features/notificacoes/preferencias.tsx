'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createBrowserSupabase } from '@/lib/supabase/client'

type Props = { pushValidacao: boolean; pushDevolvida: boolean; medico: boolean }

export function Preferencias({ pushValidacao, pushDevolvida, medico }: Props) {
  const [validacao, setValidacao] = useState(pushValidacao)
  const [devolvida, setDevolvida] = useState(pushDevolvida)
  const [estado, setEstado] = useState<'ocioso' | 'salvando' | 'salvo' | 'erro'>('ocioso')

  async function salvar() {
    setEstado('salvando')
    const { error } = await createBrowserSupabase().rpc('salvar_preferencias_notificacao', {
      p_push_validacao: validacao,
      p_push_devolvida: devolvida,
    })
    setEstado(error ? 'erro' : 'salvo')
  }

  const caixa = 'size-5 shrink-0 accent-primary'
  return (
    <section aria-labelledby="titulo-avisos" className="space-y-3">
      <h2 id="titulo-avisos" className="font-bold text-foreground">
        Avisos por push
      </h2>
      <p className="text-sm text-muted-foreground">
        Escolha quais pendências chegam como aviso no aparelho. O sino do aplicativo sempre mostra todas as notificações.
      </p>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className={caixa}
          checked={validacao}
          onChange={(e) => {
            setValidacao(e.target.checked)
            setEstado('ocioso')
          }}
        />
        <span>
          Evolução aguardando minha validação
          {!medico && <span className="block text-sm text-muted-foreground">Só médicos recebem este aviso.</span>}
        </span>
      </label>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className={caixa}
          checked={devolvida}
          onChange={(e) => {
            setDevolvida(e.target.checked)
            setEstado('ocioso')
          }}
        />
        <span>Evolução devolvida para mim</span>
      </label>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={salvar} disabled={estado === 'salvando'}>
          Salvar preferências
        </Button>
        <p role="status" className={`text-sm ${estado === 'erro' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {estado === 'salvo' && 'Preferências salvas.'}
          {estado === 'erro' && 'Não foi possível salvar. Tente novamente.'}
        </p>
      </div>
    </section>
  )
}
