import type { ReactNode } from 'react'
import { SubnavAdmin } from '@/features/admin/subnav-admin'
import { exigirAdmin } from '@/lib/auth'

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  await exigirAdmin()
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SubnavAdmin />
      {children}
    </div>
  )
}
