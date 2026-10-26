import { WifiOff } from 'lucide-react'

export const metadata = { title: 'Sem conexão' }

export default function PaginaOffline() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="flex w-full max-w-md flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-suave text-primary-suave-foreground">
          <WifiOff aria-hidden className="size-6" />
        </span>
        <h1 className="font-heading text-xl leading-snug font-bold text-foreground">Sem conexão. Abra o app quando a rede voltar.</h1>
        <p className="text-sm text-muted-foreground">Prontuário Santa Casa</p>
      </section>
    </main>
  )
}
