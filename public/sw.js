const SHELL_CACHE = "bricket-control-shell-v5";
const PRIVATE_CACHE = "bricket-control-private-v5";
const CACHE_PREFIX = "bricket-control-";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/bricket-mark.png",
  "/araya-wordmark.jpg"
];

function isCacheableResponse(response) {
  return response && response.ok && response.type !== "opaque";
}

function limitedNotificationText(value, fallback, maximum) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maximum);
}

function safeNotificationDestination(value) {
  try {
    const url = new URL(typeof value === "string" ? value : "/", self.location.origin);
    if (url.origin !== self.location.origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

async function cacheOne(cache, request) {
  try {
    const response = await fetch(request, { credentials: "same-origin" });
    if (isCacheableResponse(response)) await cache.put(request, response.clone());
  } catch {
    // A partial shell is still useful; one missing asset must not abort installation.
  }
}

async function notifyOfflineReady() {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: "OFFLINE_READY" });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(STATIC_ASSETS.map((asset) => cacheOne(cache, asset)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, PRIVATE_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const message = event.data ?? {};

  if (message.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (message.type === "CLEAR_PRIVATE_CACHE") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX))
            .map((key) => caches.delete(key))
        )
      )
    );
    return;
  }

  if (message.type === "CACHE_APP_SHELL") {
    const resourceUrls = Array.isArray(message.resourceUrls) ? message.resourceUrls : [];
    event.waitUntil(
      caches.open(PRIVATE_CACHE)
        .then(async (cache) => {
          const safeResources = Array.from(new Set(resourceUrls))
            .map((resource) => {
              try {
                const url = new URL(resource, self.location.origin);
                const cacheableStatic =
                  url.pathname.startsWith("/_next/static/") ||
                  STATIC_ASSETS.includes(url.pathname);
                if (url.origin !== self.location.origin || !cacheableStatic) return "";
                return `${url.pathname}${url.search}`;
              } catch {
                return "";
              }
            })
            .filter(Boolean);
          await Promise.all(safeResources.map((resource) => cacheOne(cache, resource)));
        })
        .then(notifyOfflineReady)
    );
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/signin") ||
    url.pathname.startsWith("/signout") ||
    url.pathname.startsWith("/auth/")
  ) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .catch(() => new Response(
            "<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Bricket Control</title><body><main><h1>Bricket Control</h1><p>Conéctate para verificar tu identidad y consultar los datos actuales.</p></main></body></html>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          ))
    );
    return;
  }

  const isPrivateDocument = url.pathname.startsWith("/data-center/");
  if (isPrivateDocument) {
    event.respondWith(fetch(event.request));
    return;
  }
  const cacheableStatic =
    url.pathname.startsWith("/_next/static/") ||
    STATIC_ASSETS.includes(url.pathname);
  if (!cacheableStatic) return;
  const targetCache = SHELL_CACHE;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (isCacheableResponse(response)) {
          const copy = response.clone();
          void caches.open(targetCache).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    const parsed = event.data ? event.data.json() : {};
    payload = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    payload = {};
  }

  const title = limitedNotificationText(payload.title, "Bricket Control", 160);
  const body = limitedNotificationText(payload.body, "Hay una nueva actividad en el Centro de Control.", 500);
  const destination = safeNotificationDestination(payload.url);
  const tag = limitedNotificationText(payload.tag, "bricket-control-live", 120);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/bricket-mark.png",
      badge: "/bricket-mark.png",
      tag,
      data: { url: destination },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = safeNotificationDestination(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          void client.navigate(destination);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(destination) : undefined;
    })
  );
});
