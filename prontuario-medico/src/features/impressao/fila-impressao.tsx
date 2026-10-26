'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type LinhaFila = {
  id: string
  paciente: string
  leito: string
  equipe: string
  validador: string
  horario: string
}

/** Pede a impressão em nova aba e atualiza a fila depois que o PDF foi gerado no servidor. */
export function FilaImpressao({ linhas }: { linhas: LinhaFila[] }) {
  const router = useRouter()
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())

  function alternar(id: string, marcada: boolean) {
    setSelecionadas((atual) => {
      const proxima = new Set(atual)
      if (marcada) proxima.add(id)
      else proxima.delete(id)
      return proxima
    })
  }

  // A via é registrada no servidor quando o PDF é gerado: a lista atualiza quando a pessoa volta para esta aba.
  useEffect(() => {
    function atualizar() {
      if (document.visibilityState === 'visible') router.refresh()
    }
    window.addEventListener('focus', atualizar)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      window.removeEventListener('focus', atualizar)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [router])

  function imprimir() {
    const ids = linhas.filter((l) => selecionadas.has(l.id)).map((l) => l.id)
    if (ids.length === 0) return
    // Chave nova a cada clique: repetir a mesma requisição do PDF não gera outra via.
    const chave = crypto.randomUUID()
    window.open(`/evolucoes/lote/pdf?ids=${ids.join(',')}&k=${chave}`, '_blank', 'noopener')
    setSelecionadas(new Set())
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {linhas.length === 1 ? '1 evolução para imprimir' : `${linhas.length} evoluções para imprimir`}
        </p>
        <Button type="button" size="lg" onClick={imprimir} disabled={selecionadas.size === 0}>
          <Printer aria-hidden />
          Imprimir selecionadas{selecionadas.size > 0 ? ` (${selecionadas.size})` : ''}
        </Button>
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input bg-card p-6 text-center text-muted-foreground">
          Nenhuma evolução pendente de impressão com estes filtros.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {linhas.map((l) => (
            <li
              key={l.id}
              className={`flex items-start gap-3 rounded-xl border border-l-4 p-3 ${selecionadas.has(l.id) ? 'border-primary-suave-borda border-l-primary bg-primary-suave' : 'border-border border-l-teal-decorativo bg-card'}`}
            >
              <input
                id={`imprimir-${l.id}`}
                type="checkbox"
                checked={selecionadas.has(l.id)}
                onChange={(e) => alternar(l.id, e.target.checked)}
                className="mt-0.5 size-6 shrink-0 accent-primary"
                aria-label={`Selecionar ${l.paciente}`}
              />
              <label htmlFor={`imprimir-${l.id}`} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
                <span className="font-heading font-bold break-words">{l.paciente}</span>
                <span className="text-sm text-muted-foreground">
                  Leito {l.leito} · {l.equipe}
                </span>
                <span className="text-sm text-muted-foreground">
                  {l.validador} · {l.horario}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
