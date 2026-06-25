// Service worker: navegação em "network-first" (sempre pega a versão mais nova
// quando online) e demais arquivos em "stale-while-revalidate". Funciona offline.
const CACHE = 'minha-carteira-v2'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  // Caminhos relativos ao escopo (funciona em "/" ou em subpasta como /wesley/).
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return

  // Páginas (navegação): tenta a rede primeiro; se offline, usa o cache.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('./index.html'))),
    )
    return
  }

  // Demais arquivos: responde do cache e atualiza em segundo plano.
  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
