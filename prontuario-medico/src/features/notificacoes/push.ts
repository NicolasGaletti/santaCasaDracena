/** Chave pública VAPID (base64url) → bytes para `pushManager.subscribe`. */
export function base64UrlParaBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const preenchido = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)
  const binario = atob(preenchido.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

/** Bytes de uma chave da assinatura (p256dh/auth) → base64url sem padding. */
export function bytesParaBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  let binario = ''
  new Uint8Array(buffer).forEach((b) => (binario += String.fromCharCode(b)))
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
