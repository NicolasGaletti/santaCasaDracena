'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { CampoCodigo } from './campo-codigo'

export const ERRO_CODIGO = 'Código inválido. Confira o app autenticador e tente de novo.'

type Fator = { id: string; qr: string; segredo: string }

/**
 * Cadastro de TOTP: gera o QR code, confere o primeiro código e só então o fator passa a valer.
 * Ao montar remove fatores abandonados (não verificados) de tentativas anteriores.
 */
export function CadastrarMfa({ destino }: { destino: string }) {
  const router = useRouter()
  const iniciou = useRef(false)
  const [fator, setFator] = useState<Fator | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (iniciou.current) return
    iniciou.current = true
    const supabase = createBrowserSupabase()
    ;(async () => {
      const { data: existentes } = await supabase.auth.mfa.listFactors()
      for (const f of existentes?.all ?? []) {
        if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Autenticador' })
      if (error || !data) {
        console.error('mfa.enroll:', error?.message)
        setErro('Não foi possível gerar o QR code. Recarregue a página e tente de novo.')
        return
      }
      setFator({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret })
    })()
  }, [])

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!fator) return
    setEnviando(true)
    setErro(null)
    const supabase = createBrowserSupabase()
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo })
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
      <ol className="space-y-5 text-sm text-foreground">
        <li className="space-y-3">
          <p>Abra o aplicativo autenticador no celular e escaneie este QR code.</p>
          <div className="mx-auto flex size-48 items-center justify-center rounded-xl border border-border bg-white p-2">
            {fator ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fator.qr} alt="QR code para cadastrar o autenticador" className="size-full" />
            ) : (
              <span className="text-xs text-muted-foreground">{erro ? '' : 'Gerando QR code...'}</span>
            )}
          </div>
          {fator && (
            <p className="text-xs text-muted-foreground">
              Sem câmera? Digite esta chave no aplicativo:{' '}
              <code data-testid="segredo-mfa" className="block break-all rounded-lg bg-muted px-2 py-1.5 font-mono text-sm text-foreground select-all">
                {fator.segredo}
              </code>
            </p>
          )}
        </li>
        <li className="space-y-3">
          <p>Digite o código de 6 dígitos que o aplicativo mostra.</p>
          <CampoCodigo id="codigo-cadastro" valor={codigo} aoMudar={setCodigo} />
        </li>
      </ol>

      {erro && (
        <p role="alert" className="rounded-lg border border-destructive-soft-borda bg-destructive-soft p-3 text-sm font-semibold text-destructive-soft-foreground">
          {erro}
        </p>
      )}

      <Button type="submit" variant="primaria" size="lg" className="w-full" disabled={!fator || enviando || codigo.length !== 6}>
        {enviando ? 'Ativando...' : 'Ativar autenticador'}
      </Button>
    </form>
  )
}
