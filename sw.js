// Service Worker para Radio El Brote PWA
// Version 1.0.0

const CACHE_NAME = 'radio-elbrote-v1.0.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  // No cachear el stream de audio para tener siempre la versión en vivo
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Cacheando archivos');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('✅ Service Worker: Instalación completa');
        return self.skipWaiting(); // Activar inmediatamente
      })
      .catch((error) => {
        console.error('❌ Service Worker: Error en instalación', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activando...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Service Worker: Eliminando cache antiguo', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activación completa');
        return self.clients.claim(); // Tomar control inmediato
      })
  );
});

// Estrategia de fetch: Network First para el stream, Cache First para assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // IMPORTANTE: NUNCA cachear el stream de audio
  if (url.hostname.includes('zeno.fm') || 
      url.hostname.includes('stream') ||
      request.destination === 'audio') {
    // Network only - siempre obtener del servidor
    event.respondWith(
      fetch(request).catch((error) => {
        console.error('❌ Error al obtener stream:', error);
        return new Response('Error al conectar con el stream', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
    );
    return;
  }
  
  // Para fonts de Google y CDN externos
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          return response || fetch(request).then((fetchResponse) => {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, fetchResponse.clone());
              return fetchResponse;
            });
          });
        })
    );
    return;
  }
  
  // Para archivos locales: Cache First
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          console.log('📦 Sirviendo desde cache:', request.url);
          return response;
        }
        
        console.log('🌐 Obteniendo de red:', request.url);
        return fetch(request)
          .then((fetchResponse) => {
            // No cachear si la respuesta no es válida
            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
              return fetchResponse;
            }
            
            // Cachear la respuesta
            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
            
            return fetchResponse;
          })
          .catch((error) => {
            console.error('❌ Error en fetch:', error);
            
            // Si es una página HTML y falla, mostrar página offline
            if (request.destination === 'document') {
              return caches.match('/');
            }
            
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Sincronización en segundo plano (opcional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-analytics') {
    event.waitUntil(
      // Aquí podrías sincronizar datos pendientes
      console.log('🔄 Sincronizando datos...')
    );
  }
});

// Notificaciones Push (para futuro)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Radio El Brote';
  const options = {
    body: data.body || 'Nueva actualización de la radio',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: 'radio-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'play',
        title: '▶️ Reproducir',
        icon: '/icon-play-96.png'
      },
      {
        action: 'close',
        title: '✖️ Cerrar',
        icon: '/icon-close-96.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Manejo de clicks en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'play') {
    event.waitUntil(
      clients.openWindow('/?autoplay=true')
    );
  } else if (event.action === 'close') {
    // Simplemente cerrar la notificación
  } else {
    // Click en la notificación en general
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Manejo de mensajes desde el cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('📻 Service Worker de Radio El Brote cargado');
