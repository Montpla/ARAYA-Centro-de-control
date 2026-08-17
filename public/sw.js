const SHELL_CACHE = "bricket-control-shell-v8";
const PRIVATE_CACHE = "bricket-control-private-v8";
const CACHE_PREFIX = "bricket-control-";

// Página que se muestra cuando una navegación no llega a la red. La anterior
// era un callejón sin salida: texto pelado, sin estilo, y —lo peor— no hacía
// nada cuando volvía internet, así que dejaba al usuario mirando una pantalla
// muerta hasta que se le ocurría recargar a mano. Ésta se recupera sola.
//
// - Escucha el evento `online` del navegador y recarga en cuanto se dispara.
// - Además sondea la red cada pocos segundos, porque ese evento no siempre
//   salta tras un corte. El sondeo usa una URL con parámetro cambiante que el
//   propio service worker deja pasar a la red (no la sirve de caché), así que
//   comprueba la conexión de verdad y no una copia guardada.
// - Y deja un botón de reintento para quien no quiera esperar.
const OFFLINE_PAGE = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bricket Control</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #0f2033; color: #f5f1ea; padding: 24px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  main { max-width: 26rem; text-align: center; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: #f0592a;
    display: inline-block; margin-bottom: 20px; animation: pulso 1.6s ease-in-out infinite; }
  @keyframes pulso { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none } }
  h1 { font-size: 1.5rem; margin: 0 0 12px; letter-spacing: -.02em; }
  p { margin: 0 0 8px; color: #c9c2b6; line-height: 1.55; }
  .estado { margin-top: 18px; font-size: .85rem; color: #8b8578; }
  button { margin-top: 24px; padding: 12px 24px; border: 0; border-radius: 10px;
    background: #f0592a; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; }
  button:focus-visible { outline: 2px solid #f5f1ea; outline-offset: 3px; }
</style></head>
<body><main>
  <span class="dot" aria-hidden="true"></span>
  <h1>Sin conexión</h1>
  <p>El Centro de Control no está roto: es tu conexión la que se ha caído. En cuanto vuelva, esta pantalla se actualizará sola.</p>
  <p class="estado" id="estado">Esperando a que vuelva internet…</p>
  <button type="button" onclick="location.reload()">Reintentar ahora</button>
</main>
<script>
  var estado = document.getElementById("estado");
  function volver() { location.reload(); }
  addEventListener("online", volver);
  function sondear() {
    fetch("/?_conn=" + Date.now(), { method: "HEAD", cache: "no-store" })
      .then(function () { estado.textContent = "Conexión recuperada, cargando…"; volver(); })
      .catch(function () {});
  }
  setInterval(sondear, 4000);
</script>
</body></html>`;
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/bricket-mark.png",
  "/bricket-mark-192.png",
  "/bricket-mark-512.png",
  "/bricket-mark-512-maskable.png",
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
                  url.pathname.startsWith("/assets/") ||
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
        .catch(() => new Response(OFFLINE_PAGE, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }))
    );
    return;
  }

  const isPrivateDocument = url.pathname.startsWith("/data-center/");
  if (isPrivateDocument) {
    event.respondWith(fetch(event.request));
    return;
  }
  const cacheableStatic =
    url.pathname.startsWith("/assets/") ||
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
