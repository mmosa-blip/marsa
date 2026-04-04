const CACHE_NAME = "marsa-v1";
const STATIC_ASSETS = [
  "/images/marsa-logo.png",
  "/images/marsa-logo-white.png",
];

// Install — cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches and take control immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip API requests and auth — always go to network
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.ok && (
          request.url.includes("/images/") ||
          request.url.includes("/_next/static/")
        )) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback — try cache
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Return offline page for navigation requests
          if (request.mode === "navigate") {
            return new Response(
              `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مرسى — غير متصل</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1C1B2E;color:#fff;font-family:system-ui,sans-serif;text-align:center}h1{color:#C9A84C;font-size:1.5rem;margin-bottom:.5rem}p{color:rgba(255,255,255,.5);font-size:.9rem}button{margin-top:1.5rem;padding:.75rem 2rem;border-radius:12px;border:none;background:#5E5495;color:#fff;font-size:.9rem;cursor:pointer}</style></head><body><div><h1>مرسى</h1><p>أنت غير متصل بالإنترنت</p><button onclick="location.reload()">إعادة المحاولة</button></div></body></html>`,
              { headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
          }
          return new Response("", { status: 408 });
        });
      })
  );
});

// Push notifications
self.addEventListener("push", (event) => {
  let data = { title: "مرسى", body: "لديك إشعار جديد", url: "/dashboard" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/images/marsa-logo.png",
      badge: "/images/marsa-logo.png",
      dir: "rtl",
      lang: "ar",
      data: { url: data.url },
      vibrate: [200, 100, 200],
    })
  );
});

// Notification click — open the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
