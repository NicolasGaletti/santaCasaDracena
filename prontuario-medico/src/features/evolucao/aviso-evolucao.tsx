'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { internacaoDoAviso, mensagemDoAviso } from './aviso'

/** Mostra o aviso de `?aviso=` uma vez e o remove da URL, mantendo os outros parâmetros. */
export function AvisoEvolucao() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const aviso = params.get('aviso')
  const internacao = internacaoDoAviso(params.get('internacao'))

  useEffect(() => {
    if (aviso === null) return
    const mensagem = mensagemDoAviso(aviso)
    if (mensagem) {
      // Finalizada pelo próprio autor: "Reabrir" leva ao prontuário, onde a reabertura é feita (e conferida).
      const reabrir =
        aviso === 'finalizada' && internacao
          ? { label: 'Reabrir', onClick: () => router.push(`/internacoes/${internacao}#ficha`) }
          : undefined
      toast.success(mensagem, { id: 'aviso-evolucao', action: reabrir })
    }
    const resto = new URLSearchParams(params.toString())
    resto.delete('aviso')
    resto.delete('internacao')
    const consulta = resto.toString()
    router.replace(consulta ? `${pathname}?${consulta}` : pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aviso])

  return null
}
