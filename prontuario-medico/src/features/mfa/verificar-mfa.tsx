'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { CampoCodigo } from './campo-codigo'
import { ERRO_CODIGO } from './cadastrar-mfa'

export function VerificarMfa({ fatorId, destino }: { fatorId: string; destino: string }) {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    const supabase = createBrowserSupabase()
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo })
    if (error) {
      setErro(ERRO_CODIGO)
      setCodigo('')
      setEnviando(false)
      return
    }
    router.replace(destino)
    router.refresh()
  }

  return (
    <form onSubmit={confirmar} className="space-y-5">
      <CampoCodigo id="codigo-verificacao" valor={codigo} aoMudar={setCodigo} />
      {erro && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={enviando || codigo.length !== 6}>
        {enviando ? 'Confirmando...' : 'Confirmar'}
      </Button>
    </form>
  )
}
