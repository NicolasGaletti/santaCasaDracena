'use client'

import { usePathname } from 'next/navigation'
import { SubnavPilulas } from '@/components/layout/subnav-pilulas'

const ABAS = [
  { href: '/admin/profissionais', rotulo: 'Profissionais' },
  { href: '/admin/equipes', rotulo: 'Equipes' },
  { href: '/admin/convenios', rotulo: 'Convênios' },
]

/** Subnavegação da administração: a pílula preenchida marca a seção atual. */
export function SubnavAdmin() {
  const pathname = usePathname()
  return <SubnavPilulas rotuloNav="Administração" itens={ABAS.map((a) => ({ ...a, ativo: pathname.startsWith(a.href) }))} />
}
