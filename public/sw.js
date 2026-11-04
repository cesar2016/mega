/* eslint-env serviceworker */
const CACHE_NAME = "mega-pwa-v3";
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/sound/message.mp3",
  "/sound/venta.mp3"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (
          res &&
          res.status === 200 &&
          (url.pathname.startsWith("/icons/") ||
            url.pathname.startsWith("/sound/") ||
            url.pathname.startsWith("/_expo/static/"))
        ) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
  );
});

// Contador persistido en memoria del Service Worker para el badge del ícono de la app
let swBadgeCount = 0;

// Recepción de notificaciones Web Push en segundo plano (cuando la app está cerrada o minimizada)
self.addEventListener("push", (event) => {
  let payload = {
    title: "Mercado Ganadero",
    body: "Tenés una nueva novedad en tu cuenta.",
    url: "/",
    tag: `mega-notif-${Date.now()}`,
    soundType: "message",
    badgeCount: 0,
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || payload.body,
        url: parsed.url || payload.url,
        tag: parsed.tag || payload.tag,
        soundType: parsed.soundType || "message",
        badgeCount: Number(parsed.badgeCount) || 0,
      };
    } catch (_e) {
      const text = event.data.text();
      if (text) {
        payload.body = text;
      }
    }
  }

  swBadgeCount = payload.badgeCount > 0 ? payload.badgeCount : swBadgeCount + 1;

  const vibratePattern =
    payload.soundType === "venta"
      ? [400, 150, 400, 150, 600]
      : [250, 120, 250];

  const options = {
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag,
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: vibratePattern,
    timestamp: Date.now(),
    data: {
      url: payload.url || "/",
      soundType: payload.soundType || "message",
    },
  };

  event.waitUntil(
    Promise.all([
      // 1. Mostrar la notificación nativa en la barra del celular (con sonido del sistema y vibración)
      self.registration.showNotification(payload.title, options),

      // 2. Activar el badge numérico en el ícono de la app instalada en el celular
      (async () => {
        try {
          if (self.navigator && typeof self.navigator.setAppBadge === "function") {
            await self.navigator.setAppBadge(swBadgeCount);
          }
        } catch (_e) {
          // ignore if OS launcher does not support numeric badge
        }
      })(),

      // 3. Si la app está minimizada o en segundo plano en memoria, ordenarle reproducir el MP3
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            client.postMessage({
              type: "MEGA_PUSH_RECEIVED",
              soundType: payload.soundType || "message",
              badgeCount: swBadgeCount,
              title: payload.title,
              body: payload.body,
            });
          }
        })
        .catch(() => {}),
    ])
  );
});

// Al tocar la notificación en el celular, abrir o enfocar la pantalla correspondiente
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || "/";
  const soundType = data.soundType || "message";

  swBadgeCount = Math.max(0, swBadgeCount - 1);
  if (self.navigator && typeof self.navigator.clearAppBadge === "function" && swBadgeCount === 0) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            client.postMessage({
              type: "MEGA_PUSH_CLICKED",
              url: targetUrl,
              soundType,
            });
            if ("navigate" in client) {
              return client.navigate(targetUrl).catch(() => {});
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          const sep = targetUrl.includes("?") ? "&" : "?";
          return self.clients.openWindow(`${targetUrl}${sep}fromPush=${soundType}`);
        }
      })
  );
});
