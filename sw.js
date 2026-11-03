// =========================================================================
// PAOLO ALDEA - GESTIÓN JURÍDICA
// Service Worker Oficial PWA & Notificaciones Push Multi-Dispositivo
// Arquitectura Híbrida Multi-Tier: Cache-First (Activos Pesados) + Network-First (Núcleo App)
// Compatible con Android (Chrome) e iOS (Safari PWA 16.4+)
// =========================================================================

const CACHE_NAME = 'paolo-aldea-pwa-v2026.11.17-fonts';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './assets/logo_paolo_aldea.jpg',
  './assets/sedes/sede-challhuahuacho.jpg',
  './assets/sedes/sede-cusco.jpg',
  './assets/sedes/sede-abancay.jpg',
  './assets/sedes/sede-miraflores.jpg',
  './assets/sedes/sede-huaraz.jpg',
  './assets/sedes/sede-nacional.jpg',
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
  './js/app-update.js',
  './js/tailwind-config.js',
  './js/auth-bridge.js',
  './js/lib-loader.js',
  './js/controller-loader.js',
  './js/enterprise/sanitize.js',
  './js/enterprise/ErrorBoundary.js',
  './js/enterprise/config.js',
  './js/enterprise/AuthService.js',
  './js/enterprise/SyncManager.js',
  './js/enterprise/CloudDataSync.js',
  './js/enterprise/PushService.js',
  './js/enterprise/AttendanceService.js',
  './js/enterprise/CashManager.js',
  './js/enterprise/CaseService.js',
  './js/enterprise/BudgetAnalytics.js',
  './js/enterprise/bootstrap.js',
  './js/attendance.js',
  './js/attendance-kpis.js',
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
  // No activar solo: la pantalla pide confirmación para no cortar un registro a medias.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW] Cache parcial de recursos offline:', err);
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/functions/')) return;

  // Ignorar APIs externas (Firestore, Supabase, Telegram, push endpoints del navegador)
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

// Web Push en segundo plano — payload genérico (sin datos de expediente)
self.addEventListener('push', (event) => {
  let data = {
    title: 'PAOLO ALDEA — Aviso del despacho',
    body: 'Hay un aviso perentorio. Abra la suite segura para ver el detalle.',
    tag: 'alerta-despacho',
    url: './index.html?open=alerts'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        if (parsed.title) data.title = String(parsed.title).slice(0, 80);
        if (parsed.body) data.body = String(parsed.body).slice(0, 180);
        if (parsed.tag) data.tag = String(parsed.tag).slice(0, 64);
        if (parsed.url) data.url = String(parsed.url).slice(0, 200);
      }
    } catch (e) {
      const txt = event.data.text();
      if (txt) data.body = String(txt).slice(0, 180);
    }
  }

  const options = {
    body: data.body,
    icon: 'assets/logo_paolo_aldea.jpg',
    badge: 'assets/logo_paolo_aldea.jpg',
    tag: data.tag || 'alerta-despacho',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 400],
    data: {
      url: data.url || './index.html?open=alerts',
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open', title: 'Abrir despacho' },
      { action: 'dismiss', title: 'Entendido' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl =
    (event.notification.data && event.notification.data.url) || './index.html?open=alerts';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      if (
        targetUrl &&
        (targetUrl.includes('meet.google.com') ||
          (targetUrl.startsWith('http') && !targetUrl.includes(self.location.origin) && !targetUrl.includes('index.html')))
      ) {
        if (clients.openWindow) return clients.openWindow(targetUrl);
      }

      const abs =
        targetUrl.startsWith('http')
          ? targetUrl
          : new URL(targetUrl, self.registration.scope).href;

      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus().then((focused) => {
            if (focused && typeof focused.postMessage === 'function') {
              focused.postMessage({ type: 'PA_OPEN_ALERTS', url: abs });
            }
            return focused;
          });
        }
      }
      if (clients.openWindow) return clients.openWindow(abs);
    })
  );
});
