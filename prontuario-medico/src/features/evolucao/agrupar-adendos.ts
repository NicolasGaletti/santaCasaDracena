export type EntradaTimeline<T> = { item: T; recuo: boolean }

type ComAdendo = { id: string; adendo_de?: string | null; criado_em: string }

/**
 * Ordem da timeline: cada adendo logo abaixo da sua original, recuado, em ordem cronológica.
 * Com filtro, a original só aparece se passar; adendo que passa sem a original vira item comum.
 * Adendo cuja original não está na lista também vira item comum.
 */
export function agruparAdendos<T extends ComAdendo>(itens: T[], incluir: (item: T) => boolean = () => true): EntradaTimeline<T>[] {
  const ids = new Set(itens.map((i) => i.id))
  const ehOriginal = (i: T) => !i.adendo_de || !ids.has(i.adendo_de)
  const adendosDe = new Map<string, T[]>()
  for (const i of itens) {
    if (ehOriginal(i)) continue
    const lista = adendosDe.get(i.adendo_de as string) ?? []
    lista.push(i)
    adendosDe.set(i.adendo_de as string, lista)
  }
  for (const lista of adendosDe.values()) {
    lista.sort((a, b) => a.criado_em.localeCompare(b.criado_em))
  }

  const resultado: EntradaTimeline<T>[] = []
  for (const original of itens.filter(ehOriginal)) {
    const filhos = (adendosDe.get(original.id) ?? []).filter(incluir)
    if (incluir(original)) {
      resultado.push({ item: original, recuo: false })
      resultado.push(...filhos.map((item) => ({ item, recuo: true })))
    } else {
      resultado.push(...filhos.map((item) => ({ item, recuo: false })))
    }
  }
  return resultado
}
