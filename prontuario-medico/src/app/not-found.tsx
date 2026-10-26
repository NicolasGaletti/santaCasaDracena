import Link from 'next/link'

export default function PaginaNaoEncontrada() {
  return (
    <section className="flex flex-col gap-4 py-8">
      <h1 className="text-2xl font-bold leading-snug">Página não encontrada.</h1>
      <Link href="/" className="inline-flex min-h-11 w-fit items-center font-semibold text-primary underline-offset-4 hover:underline">
        Ir para o início
      </Link>
    </section>
  )
}
