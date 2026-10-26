const TITULOS = /^(dr|dra|sr|sra|prof|profa)\.?$/i

/** Iniciais para o avatar: ignora títulos, trechos entre parênteses e partes sem letra. */
export function iniciais(nome: string): string {
  const partes = nome
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter((p) => /^\p{L}/u.test(p) && !TITULOS.test(p))
  const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : (partes[0] ?? '?').slice(0, 2)
  return letras.toUpperCase()
}
