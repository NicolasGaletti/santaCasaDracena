'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { mensagemDoAviso } from './aviso'

/** Mostra o aviso de `?aviso=` uma vez e o remove da URL, mantendo os outros parâmetros. */
export function AvisoEvolucao() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const aviso = params.get('aviso')

  useEffect(() => {
    if (aviso === null) return
    const mensagem = mensagemDoAviso(aviso)
    if (mensagem) toast.success(mensagem, { id: 'aviso-evolucao' })
    const resto = new URLSearchParams(params.toString())
    resto.delete('aviso')
    const consulta = resto.toString()
    router.replace(consulta ? `${pathname}?${consulta}` : pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aviso])

  return null
}
