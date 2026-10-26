// Service worker de push (Plano 4, Task 7c). Sem fetch e sem cache.
// A Task 10 move estes handlers para o service worker do Serwist, no mesmo URL.
self.addEventListener('push', (event) => {
  let dados = {}
  try {
    dados = event.data ? event.data.json() : {}
  } catch {
    dados = {}
  }
  const titulo = typeof dados.title === 'string' && dados.title ? dados.title : 'Prontuário Santa Casa'
  const corpo = typeof dados.body === 'string' ? dados.body : ''
  const url = typeof dados.url === 'string' ? dados.url : '/notificacoes'
  event.waitUntil(self.registration.showNotification(titulo, { body: corpo, data: { url } }))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const bruto = event.notification.data && event.notification.data.url
  // Só mesma origem: o parser do URL normaliza "/\\evil.com" e afins; origem diferente cai na lista.
  let url = '/notificacoes'
  try {
    const u = new URL(bruto, self.location.origin)
    if (u.origin === self.location.origin) url = u.pathname + u.search + u.hash
  } catch {
    url = '/notificacoes'
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin && 'focus' in janela) {
          return janela
            .focus()
            .then((j) => ('navigate' in j ? j.navigate(url) : undefined))
            .catch(() => self.clients.openWindow(url))
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
