const CACHE = "sokutei-care-v9";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./art/fascia.jpg", "./art/fascia-b.jpg", "./art/gastroc.jpg", "./art/gastroc-b.jpg",
  "./art/soleus.jpg", "./art/soleus-b.jpg", "./art/towel.jpg", "./art/towel-b.jpg",
  "./art/heelraise.jpg", "./art/heelraise-b.jpg", "./art/ice.jpg", "./art/ice-b.jpg",
  "./icons/favicon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
// ネットワーク優先・オフライン時のみキャッシュ(更新が確実に届くように)
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

self.addEventListener("periodicsync", e => {
  if (e.tag === "daily-reminder") {
    const morning = new Date().getHours() < 12;
    e.waitUntil(self.registration.showNotification("足底腱膜炎ケア手帳", {
      body: morning ? "朝の一歩目の痛み記録とストレッチの時間です" : "夜の痛み記録の時間です",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: "daily-reminder",
    }));
  }
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window" }).then(list => {
    if (list.length) return list[0].focus();
    return clients.openWindow("./index.html");
  }));
});
