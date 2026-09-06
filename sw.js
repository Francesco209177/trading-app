/* ============================================================
   Service worker: tiene in cache SOLO il guscio dell'app
   (pagina, stile, script, icone) così si apre all'istante.

   Non tocca mai i dati: le chiamate a GitHub e agli exchange
   passano sempre dalla rete, altrimenti vedresti numeri vecchi.
   La chiave non passa di qui e non viene mai salvata.
   ============================================================ */

const CACHE = "portafoglio-bot-v1";

const SHELL = [
  "./",
  "./index.html",
  "./css/style.css?v=1",
  "./js/config.js?v=1",
  "./js/gate.js?v=1",
  "./js/github.js?v=1",
  "./js/prices.js?v=1",
  "./js/equity.js?v=1",
  "./js/chart.js?v=1",
  "./js/app.js?v=1",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// La libreria del grafico sta su un CDN: la teniamo da parte
// per far aprire l'app anche con rete pessima.
const CHART_LIB = "https://cdn.jsdelivr.net/npm/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Dati (GitHub, Binance, Kraken): sempre e solo rete.
  if (!sameOrigin && request.url !== CHART_LIB) return;

  // La pagina: prima la rete, con la copia in cache come rete di salvataggio.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html", { ignoreSearch: true }))
    );
    return;
  }

  // Guscio e libreria: prima la cache (apertura istantanea), poi si aggiorna dietro le quinte.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
