// public/sw.js - Fixed Service Worker Syntax Error
const CACHE_NAME = 'olivehaus-pm-v1';
const urlsToCache = [
  '/',
  '/login',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          function(response) {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Push event - handle push notifications
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');

  if (event.data) {
    const data = event.data.json();
    console.log('[Service Worker] Push had this data: ', data);

    const title = data.title || 'Olivehaus Notification';
    const options = {
      body: data.message || data.body || 'You have a new notification',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: data.tag || 'general',
      data: {
        url: data.url || '/',
        projectId: data.projectId,
        taskId: data.taskId,
        messageId: data.messageId,
        ...data.data
      },
      actions: data.actions || [
        {
          action: 'view',
          title: 'View',
          icon: '/icon-192x192.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icon-192x192.png'
        }
      ],
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      vibrate: data.vibrate || [100, 50, 100],
      timestamp: Date.now()
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click received.');

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const data = event.notification.data;
  let url = '/';

  if (event.action === 'view' || !event.action) {
    if (data.url) {
      url = data.url;
    } else if (data.projectId) {
      url = `/projects/${data.projectId}`;
    } else if (data.taskId) {
      url = `/tasks/${data.taskId}`;
    } else if (data.messageId) {
      url = `/messages`;
    }
  }

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }

      // If no window/tab is already open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Notification close event
self.addEventListener('notificationclose', function(event) {
  console.log('[Service Worker] Notification closed:', event.notification.tag);
  
  // You can track notification dismissals here if needed
  // Example: Send analytics data about notification engagement
});

// Background sync event (for offline functionality)
self.addEventListener('sync', function(event) {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Sync offline actions when connection is restored
  return new Promise((resolve) => {
    // Your background sync logic here
    console.log('[Service Worker] Background sync completed');
    resolve();
  });
}

// Message event - handle messages from main thread
self.addEventListener('message', function(event) {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Error handling
self.addEventListener('error', function(event) {
  console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', function(event) {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});