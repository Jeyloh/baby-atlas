// Baby Atlas service worker: lets the installed app open without a connection.
// Build assets are cached forever (their names change on every deploy). Pages
// are fetched from the network first and fall back to the last copy. API calls
// are never cached: queued quick actions and saved query data cover those.
// The worker also shows push notifications and opens the app when one is tapped.

const VERSION = "v2";
const STATIC_CACHE = `static-${VERSION}`;
// Sign-out deletes caches starting with "pages-" (signOutAndClearDevice)
const PAGE_CACHE = `pages-${VERSION}`;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC_CACHE, PAGE_CACHE];
      for (const key of await caches.keys()) {
        if (!keep.includes(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});

// The server sends JSON: { title, body, tag, url }. Only paths inside this app
// are opened, so a notification can never send the user to another site.
const NOTIFICATION_ICON = "/pwa-icon/192";

function safeAppPath(url) {
  if (typeof url !== "string") return "/dashboard";
  if (!url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) return "/dashboard";
  return url;
}

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    data: { url: safeAppPath(data.url) },
  };
  if (typeof data.tag === "string" && data.tag) {
    options.tag = data.tag;
    options.renotify = true;
  }

  event.waitUntil(
    self.registration.showNotification(
      typeof data.title === "string" && data.title ? data.title : "Baby Atlas",
      options
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safeAppPath(event.notification.data && event.notification.data.url), self.location.origin);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          await client.focus();
          if ("navigate" in client) await client.navigate(target.href);
          return;
        } catch {
          // Fall through to opening a new window
        }
      }
      await self.clients.openWindow(target.href);
    })()
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

// A weak connection at night can hang for a long time, so the cached copy
// wins after a few seconds. The network answer still refreshes the cache.
async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);

  const network = fetch(request).then((response) => {
    // Redirects (for example to the login page) come back opaque and are skipped
    if (response.ok && response.type === "basic") {
      void cache.put(request, response.clone());
    }
    return response;
  });
  network.catch(() => {});

  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  const first = await Promise.race([network.catch(() => undefined), timeout]);
  if (first) return first;

  // Next.js varies pages on router headers that change between visits
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  try {
    return await network;
  } catch {
    return offlineResponse(request);
  }
}

function offlineResponse(request) {
  if (request.mode !== "navigate") return Response.error();
  const html = `<!doctype html><html lang="nb"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Baby Atlas</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center;color:#17242b}</style>
</head><body><div><h1>Du er uten nett</h1>
<p>Denne siden er ikke lagret på telefonen ennå. Åpne Baby Atlas på nytt når du har nett.</p>
<p><a href="/dashboard">Gå til forsiden</a></p></div></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
