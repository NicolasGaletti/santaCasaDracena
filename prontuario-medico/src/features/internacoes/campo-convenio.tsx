'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

type Props = {
  opcoes: { id: string; nome: string }[]
  defaultValue?: string
  erro?: string
}

/** Convênio escolhido da lista: select nativo estilizado (abre a roda do sistema no celular). */
export function CampoConvenio({ opcoes, defaultValue = '', erro }: Props) {
  // Controlado: o reset do formulário após a ação não pode apagar a escolha.
  const [valor, setValor] = useState(defaultValue)
  const ref = useRef<HTMLSelectElement>(null)
  // O navegador devolve o select ao estado inicial quando o formulário é limpo; reaplica a escolha.
  useEffect(() => {
    if (ref.current && ref.current.value !== valor) ref.current.value = valor
  })
  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <select
          ref={ref}
          id="convenio"
          name="convenio"
          required
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? 'convenio-erro' : undefined}
          className="h-11 w-full min-w-0 appearance-none rounded-lg border border-input bg-campo py-1 pr-10 pl-3 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 sm:text-sm"
        >
          <option value="" disabled>
            Escolha o convênio
          </option>
          {opcoes.map((o) => (
            <option key={o.id} value={o.nome}>
              {o.nome}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {erro && (
        <p id="convenio-erro" role="alert" className="text-[13px] font-semibold text-destructive-soft-foreground">
          {erro}
        </p>
      )}
    </div>
  )
}
