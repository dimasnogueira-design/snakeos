// No conversation, usage, credentials or authenticated HTML are cached.
self.addEventListener('install', event => {self.skipWaiting();event.waitUntil(caches.open('snake-public-v1').then(c=>c.addAll(['/offline.html','/icon.svg'])));});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));
});
