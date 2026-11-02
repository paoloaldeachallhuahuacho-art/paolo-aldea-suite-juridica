// =========================================================================
// PAOLO ALDEA - GESTIÓN JURÍDICA
// Service Worker Oficial PWA & Notificaciones Push Multi-Dispositivo
// Arquitectura Híbrida Multi-Tier: Cache-First (Activos Pesados) + Network-First (Núcleo App)
// Compatible con Android (Chrome) e iOS (Safari PWA 16.4+)
// =========================================================================

const CACHE_NAME = 'paolo-aldea-pwa-v2026.11-csp-handlers';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './assets/logo_paolo_aldea.jpg',
  './lib/tailwind.js',
  './lib/chart.min.js',
  './lib/exceljs.min.js',
  './lib/FileSaver.min.js',
  './lib/html2pdf.bundle.min.js',
  './lib/fa/css/all.min.css',
  './lib/fa/webfonts/fa-solid-900.woff2',
  './lib/fa/webfonts/fa-regular-400.woff2',
  './lib/fa/webfonts/fa-brands-400.woff2',
  './js/data.js',
  './js/boot-early.js',
  './js/tailwind-config.js',
  './js/auth-bridge.js',
  './js/lib-loader.js',
  './js/controller-loader.js',
  './js/enterprise/sanitize.js',
  './js/enterprise/ErrorBoundary.js',
  './js/enterprise/config.js',
  './js/enterprise/AuthService.js',
  './js/enterprise/SyncManager.js',
  './js/enterprise/AttendanceService.js',
  './js/enterprise/CashManager.js',
  './js/enterprise/CaseService.js',
  './js/enterprise/BudgetAnalytics.js',
  './js/enterprise/bootstrap.js',
  './js/attendance.js',
  './js/draft-autosave.js',
  './js/controllers/cases.controller.js',
  './js/controllers/budget.controller.js',
  './js/controllers/pettycash.controller.js',
  './js/controllers/calendar.controller.js',
  './js/controllers/inventory.controller.js',
  './js/controllers/documents.controller.js',
  './js/controllers/admin.controller.js',
  './js/component-loader.js',
  './js/alerts.js',
  './js/charts.js',
  './js/excel-export.js',
  './js/pdf-export.js',
  './js/firebase-auth.js',
  './js/app.js',
  './views/view-asistencia.html',
  './views/view-caja_chica.html',
  './views/view-casos.html',
  './views/view-citas.html',
  './views/view-documentos.html',
  './views/view-inventario.html',
  './views/view-kpis.html',
  './views/view-master_admin.html',
  './views/view-modals.html',
  './views/view-personal.html',
  './views/view-presupuestos.html',
  './views/view-roles_permisos.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW] Cache parcial de recursos offline:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Limpiando cache previa:', k);
          return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Híbrida Multi-Tier:
// - Tier 1 (Cache-First): Librerías pesadas inmutables (/lib/*), iconos (/assets/*), fuentes (.woff2, Google Fonts)
// - Tier 2 (Network-First con fallback a Cache): HTML, controladores y lógica de negocio (/js/*, /css/*)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignorar peticiones de APIs en tiempo real (Firestore, Supabase, Telegram, ntfy)
  if (!url.origin.includes(self.location.origin) && !url.origin.includes('fonts.googleapis.com') && !url.origin.includes('fonts.gstatic.com') && !url.origin.includes('gstatic.com')) {
    return;
  }

  const isStaticImmutableAsset =
    url.pathname.includes('/lib/') ||
    url.pathname.includes('/assets/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.png') ||
    url.origin.includes('fonts.gstatic.com');

  if (isStaticImmutableAsset) {
    // Tier 1: Cache-First con actualización en segundo plano
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Tier 2: Network-First con fallback instantáneo a Cache para modo Offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.destination === 'document' || event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// Listener de eventos push nativos del navegador / celular
self.addEventListener('push', (event) => {
  let data = {
    title: 'PAOLO ALDEA & ABOGADOS — Alerta Jurídica',
    body: 'Tiene un plazo procesal perentorio o audiencia inminente.',
    tag: 'alerta-judicial',
    url: './index.html'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: 'assets/logo_paolo_aldea.jpg',
    badge: 'assets/logo_paolo_aldea.jpg',
    tag: data.tag || 'alerta-judicial',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 400],
    data: {
      url: data.url || './index.html',
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open', title: 'Ver Despacho' },
      { action: 'dismiss', title: 'Entendido' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './index.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      if (targetUrl && (targetUrl.includes('meet.google.com') || (targetUrl.startsWith('http') && !targetUrl.includes('index.html')))) {
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }

      for (let client of windowClients) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
