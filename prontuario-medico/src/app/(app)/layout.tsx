import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell'
import { exigirProfissional } from '@/lib/auth'

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const profissional = await exigirProfissional()
  return <AppShell profissional={profissional}>{children}</AppShell>
}
