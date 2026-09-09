"use strict";

const CACHE_NAME = "what-i-made-capture-v43";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=43",
  "./config.js?v=35",
  "./transcribe-codec.js?v=16",
  "./transcribe-adapter.js?v=40",
  "./capture-parser.js?v=16",
  "./capture-assistance.js?v=27",
  "./dish-matcher.js?v=40",
  "./capture-draft.js?v=16",
  "./photo-url.js?v=16",
  "./photo-processor.js?v=16",
  "./assets/world-map-data.js?v=29",
  "./country-combobox.js?v=40",
  "./assets/international-dishes.js?v=40",
  "./dish-recognizer.js?v=40",
  "./map-geometry.js?v=43",
  "./account-context.js?v=31",
  "./auth-session.js?v=38",
  "./archive-store.js?v=31",
  "./idea-store.js?v=18",
  "./archive-backup.js?v=29",
  "./legacy-migration.js?v=33",
  "./recipe-client.js?v=18",
  "./assets/culinary-regions.js?v=16",
  "./dashboard-model.js?v=29",
  "./journal-model.js?v=25",
  "./demo-archive.js?v=42",
  "./audio-worklet.js",
  "./app.js?v=43",
  "./manifest.webmanifest?v=30",
  "./assets/app-icon-192.png",
  "./assets/app-icon-512.png",
  "./assets/apple-touch-icon.png?v=30",
  "./assets/favicon-32.png?v=30",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            // Cloned fetch responses retain their original URL metadata. Rebuild
            // the shell so callback values cannot survive as cached Response.url.
            const canonicalResponse = new Response(await response.clone().arrayBuffer(), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
            const cache = await caches.open(CACHE_NAME);
            await cache.put("./index.html", canonicalResponse);
          }
          return response;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw new Error("No cached response is available.");
      }),
  );
});
