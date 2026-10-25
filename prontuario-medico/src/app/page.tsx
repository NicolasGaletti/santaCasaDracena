import { exigirProfissional } from '@/lib/auth'
import { sair } from '@/app/login/actions'

export default async function Home() {
  const profissional = await exigirProfissional()

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold text-slate-800">Internados</h1>
      <p className="text-sm text-slate-600">{profissional.nome}</p>
      <form action={sair} className="mt-4">
        <button type="submit" className="rounded-lg bg-slate-200 px-3 py-2 text-sm text-slate-800">
          Sair
        </button>
      </form>
    </main>
  )
}
