const CACHE_NAME = 'zhajinhua-v1'
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
]

// 安装 Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS)
    })
  )
  self.skipWaiting()
})

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// 网络优先策略（适合实时游戏）
self.addEventListener('fetch', (event) => {
  // 跳过 WebSocket 和 API 请求
  if (event.request.url.includes('ws://') || 
      event.request.url.includes('wss://') ||
      event.request.url.includes('/api/')) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 缓存成功的请求
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone)
          })
        }
        return response
      })
      .catch(() => {
        // 网络失败时使用缓存
        return caches.match(event.request)
      })
  )
})
