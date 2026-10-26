'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ABAS = [
  { href: '/admin/profissionais', rotulo: 'Profissionais' },
  { href: '/admin/equipes', rotulo: 'Equipes' },
  { href: '/admin/convenios', rotulo: 'Convênios' },
]

/** Subnavegação da administração: sublinhado marca a seção atual. */
export function SubnavAdmin() {
  const pathname = usePathname()
  return (
    <nav aria-label="Administração" className="flex gap-6 border-b border-border">
      {ABAS.map((a) => {
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
