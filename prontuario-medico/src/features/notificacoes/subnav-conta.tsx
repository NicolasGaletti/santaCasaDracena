'use client'

import { usePathname } from 'next/navigation'
import { SubnavPilulas } from '@/components/layout/subnav-pilulas'

/** Subnavegação da área da conta. Admin não tem notificações clínicas. */
export function SubnavConta({ admin }: { admin: boolean }) {
  const pathname = usePathname()
  const abas = [
    { href: '/conta/seguranca', rotulo: 'Segurança' },
    ...(admin ? [] : [{ href: '/conta/notificacoes', rotulo: 'Notificações' }]),
  ]
  return <SubnavPilulas rotuloNav="Conta" itens={abas.map((a) => ({ ...a, ativo: pathname.startsWith(a.href) }))} />
}
