import Link from 'next/link'
import type { ComponentProps } from 'react'

export type ItemSubnav = { href: ComponentProps<typeof Link>['href']; rotulo: string; ativo: boolean }

/** Subnavegação em pílulas (mesmo desenho da navegação principal): a ativa fica preenchida em teal. */
export function SubnavPilulas({ rotuloNav, itens }: { rotuloNav: string; itens: ItemSubnav[] }) {
  return (
    <nav aria-label={rotuloNav} className="flex flex-wrap gap-2">
      {itens.map((a) => (
        <Link
          key={a.rotulo}
          href={a.href}
          aria-current={a.ativo ? 'page' : undefined}
          className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors ${
            a.ativo ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-texto-forte hover:bg-muted'
          }`}
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  )
}
