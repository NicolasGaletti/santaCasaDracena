'use client'

import { useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'
import { CartaoSecao } from '@/components/layout/cartao-secao'
import { Button } from '@/components/ui/button'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { base64UrlParaBytes, bytesParaBase64Url } from './push'

const CHAVE_VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
type Estado = 'verificando' | 'indisponivel' | 'negada' | 'inativo' | 'ativo'

function suportado(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function AtivarPush() {
  const [estado, setEstado] = useState<Estado>('verificando')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    async function verificar() {
      if (!suportado() || !CHAVE_VAPID) return vivo && setEstado('indisponivel')
      if (Notification.permission === 'denied') return vivo && setEstado('negada')
      const registro = await navigator.serviceWorker.getRegistration('/')
      const assinatura = await registro?.pushManager.getSubscription()
      if (vivo) setEstado(assinatura ? 'ativo' : 'inativo')
    }
    void verificar()
    return () => {
      vivo = false
    }
  }, [])

  async function ativar() {
    if (!CHAVE_VAPID) return
    setOcupado(true)
    setErro(null)
    try {
      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') {
        setEstado(permissao === 'denied' ? 'negada' : 'inativo')
        return
      }
      // O registro do service worker é feito uma vez no layout (SerwistProvider).
      const registro = await navigator.serviceWorker.ready
      const assinatura =
        (await registro.pushManager.getSubscription()) ??
        (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlParaBytes(CHAVE_VAPID) }))
      const { error } = await createBrowserSupabase().rpc('registrar_assinatura_push', {
        p_endpoint: assinatura.endpoint,
        p_p256dh: bytesParaBase64Url(assinatura.getKey('p256dh')),
        p_auth: bytesParaBase64Url(assinatura.getKey('auth')),
      })
      if (error) {
        await assinatura.unsubscribe()
        throw error
      }
      setEstado('ativo')
    } catch {
      setErro('Não foi possível ativar as notificações neste aparelho. Tente novamente.')
    } finally {
      setOcupado(false)
    }
  }

  async function desativar() {
    setOcupado(true)
    setErro(null)
    try {
      const registro = await navigator.serviceWorker.getRegistration('/')
      const assinatura = await registro?.pushManager.getSubscription()
      if (assinatura) {
        await createBrowserSupabase().rpc('remover_assinatura_push', { p_endpoint: assinatura.endpoint })
        await assinatura.unsubscribe()
      }
      setEstado('inativo')
    } catch {
      setErro('Não foi possível desativar. Tente novamente.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <CartaoSecao titulo="Este aparelho" icone={Smartphone} className="max-w-xl">
     <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        No iPhone, as notificações só funcionam com o app instalado na tela inicial.
      </p>
      {estado === 'indisponivel' && (
        <p className="rounded-lg bg-muted p-3 text-sm">Notificações push não estão disponíveis neste navegador ou neste ambiente.</p>
      )}
      {estado === 'negada' && (
        <p className="rounded-lg bg-muted p-3 text-sm">
          As notificações estão bloqueadas neste aparelho. Libere nas configurações do navegador e volte aqui.
        </p>
      )}
      {estado === 'inativo' && (
        <Button type="button" variant="primaria" onClick={ativar} disabled={ocupado}>
          Ativar notificações neste aparelho
        </Button>
      )}
      {estado === 'ativo' && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            Notificações ativas neste aparelho.
          </p>
          <Button type="button" variant="outline" onClick={desativar} disabled={ocupado}>
            Desativar neste aparelho
          </Button>
        </div>
      )}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
     </div>
    </CartaoSecao>
  )
}
