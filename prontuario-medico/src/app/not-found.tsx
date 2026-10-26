import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PaginaNaoEncontrada() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="flex w-full max-w-md flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-suave text-primary-suave-foreground">
          <SearchX aria-hidden className="size-6" />
        </span>
        <h1 className="font-heading text-xl leading-snug font-bold text-foreground">Página não encontrada.</h1>
        <Button asChild variant="primaria" size="lg">
          <Link href="/">Ir para o início</Link>
        </Button>
      </section>
    </main>
  )
}
