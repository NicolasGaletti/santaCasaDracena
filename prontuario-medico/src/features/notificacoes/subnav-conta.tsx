'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Subnavegação da área da conta. Admin não tem notificações clínicas. */
export function SubnavConta({ admin }: { admin: boolean }) {
  const pathname = usePathname()
  const abas = [
    { href: '/conta/seguranca', rotulo: 'Segurança' },
    ...(admin ? [] : [{ href: '/conta/notificacoes', rotulo: 'Notificações' }]),
  ]
  return (
    <nav aria-label="Conta" className="flex gap-6 border-b border-border">
      {abas.map((a) => {
        const ativo = pathname.startsWith(a.href)
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativo ? 'page' : undefined}
            className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-1 font-semibold transition-colors ${
              ativo ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {a.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
