import type { ReactNode } from 'react'
import { connection } from 'next/server'

// Renderização por requisição: o nonce do CSP só chega a páginas dinâmicas.
export default async function Layout({ children }: { children: ReactNode }) {
  await connection()
  return children
}
