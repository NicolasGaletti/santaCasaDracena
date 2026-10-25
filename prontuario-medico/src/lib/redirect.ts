const ORIGEM_INTERNA = 'http://interno.local'
const CONTROLE = /[\x00-\x1f\x7f]/

export function destinoSeguro(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || CONTROLE.test(next)) return '/'

  let url: URL
  try {
    url = new URL(next, ORIGEM_INTERNA)
  } catch {
    return '/'
  }
  if (url.origin !== ORIGEM_INTERNA) return '/'

  let caminho: string
  try {
    caminho = decodeURIComponent(url.pathname)
  } catch {
    return '/'
  }
  if (/^\/[/\\]/.test(caminho)) return '/'

  return url.pathname + url.search
}
