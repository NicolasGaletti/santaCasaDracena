import type { createClient } from '@/lib/supabase/server'

type ClienteServidor = Awaited<ReturnType<typeof createClient>>

/**
 * Remove os objetos do bucket `anexos` com o cliente do usuário. Caminho já ausente conta como
 * removido. Retorna `false` se a listagem ou a remoção falhar, ou se algum objeto existente não sair.
 */
export async function removerObjetosAnexo(supabase: ClienteServidor, caminhos: string[]): Promise<boolean> {
  const existentes: string[] = []
  for (const caminho of caminhos) {
    const pasta = caminho.slice(0, caminho.lastIndexOf('/'))
    const nome = caminho.slice(caminho.lastIndexOf('/') + 1)
    const { data, error } = await supabase.storage.from('anexos').list(pasta, { limit: 5, search: nome })
    if (error) return false
    if (data?.some((o) => o.name === nome)) existentes.push(caminho)
  }
  if (existentes.length === 0) return true

  const { data, error } = await supabase.storage.from('anexos').remove(existentes)
  return !error && (data?.length ?? 0) === existentes.length
}
