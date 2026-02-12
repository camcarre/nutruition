const CACHE_NAME = "nutrition-v1"; 
const urlsToCache = ["/"]; 

self.addEventListener("install", event => { 
  event.waitUntil( 
    caches.open(CACHE_NAME).then(cache => { 
      return cache.addAll(urlsToCache); 
    }) 
  ); 
});

self.addEventListener("push", event => { 
  const data = event.data.json(); 
  self.registration.showNotification(data.title, { 
    body: data.body, 
    icon: "/icons/icon-192x192.png" 
  }); 
}); 

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow("/")
  );
});

self.addEventListener("fetch", event => { 
  event.respondWith( 
    caches.match(event.request).then(response => { 
      return response || fetch(event.request); 
    }) 
  ); 
});