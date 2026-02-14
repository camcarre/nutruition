const CACHE_NAME = "nutrition-v2"; 
const urlsToCache = [
  "/",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/login",
  "/register"
]; 

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
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith( 
    caches.match(event.request).then(response => { 
      if (response) {
        return response;
      }
      return fetch(event.request).catch(err => {
        console.error("SW fetch failed:", err);
        // Don't throw, just let it fail naturally or return a fallback
      });
    }) 
  ); 
});