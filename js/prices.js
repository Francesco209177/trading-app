/* ============================================================
   Prezzi di mercato, presi direttamente dal browser.

   - Tick in tempo reale: WebSocket di Binance (ogni singolo scambio).
     Se non si apre o cade, si passa a Kraken — che è anche la fonte
     prezzi del bot, quindi i numeri restano coerenti col resoconto.
   - Candele storiche: servono per ricostruire il grafico del passato.

   Sono tutte API pubbliche: nessuna chiave, nessuna registrazione.
   ============================================================ */

const Prices = (() => {
  const prices = {}; // "BTC/USDT" -> numero
  let pairs = [];
  let sock = null;
  let source = "—";
  let status = "connecting"; // connecting | live | offline
  let attempts = 0;
  let lastMessageAt = 0;
  let watchdog = null;

  let onTick = () => {};
  let onStatus = () => {};

  function setStatus(next) {
    if (status === next) return;
    status = next;
    onStatus(status, source);
  }

  function set(pair, value) {
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) return;
    prices[pair] = price;
    lastMessageAt = Date.now();
    onTick(prices);
  }

  /* ---------------- foto iniziale dei prezzi (REST) ----------------
     Serve a mostrare un numero subito, senza aspettare il primo tick. */

  async function snapshot() {
    try {
      const list = encodeURIComponent(JSON.stringify(pairs.map(Sym.binance)));
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${list}`);
      if (!res.ok) throw new Error("binance");
      const rows = await res.json();
      rows.forEach((row) => {
        const pair = pairs.find((p) => Sym.binance(p) === row.symbol);
        if (pair) set(pair, row.price);
      });
      return true;
    } catch (e) {
      return snapshotKraken();
    }
  }

  async function snapshotKraken() {
    try {
      const list = pairs.map(Sym.krakenRest).join(",");
      const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${list}`);
      const body = await res.json();
      Object.entries(body.result || {}).forEach(([key, row]) => {
        const pair = pairs.find((p) => Sym.krakenRest(p) === key);
        if (pair && row.c) set(pair, row.c[0]);
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------------- tick in tempo reale (WebSocket) ---------------- */

  function open(url, name, handle, onFail, onOpen) {
    let dead = false;
    const fail = () => {
      if (dead) return;
      dead = true;
      try {
        socket.close();
      } catch (e) {}
      if (sock === socket) sock = null;
      onFail();
    };

    let socket;
    try {
      socket = new WebSocket(url);
    } catch (e) {
      return onFail();
    }
    sock = socket;

    // Se in 7 secondi non si apre, lo consideriamo morto e proviamo l'altro.
    const timer = setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) fail();
    }, 7000);

    socket.onopen = () => {
      clearTimeout(timer);
      source = name;
      attempts = 0;
      lastMessageAt = Date.now();
      setStatus("live");
      if (onOpen) onOpen(socket);
      onStatus(status, source);
    };

    socket.onmessage = (event) => {
      lastMessageAt = Date.now();
      try {
        handle(event.data);
      } catch (e) {
        /* messaggio non riconosciuto: si ignora */
      }
    };

    socket.onerror = () => {};

    socket.onclose = () => {
      clearTimeout(timer);
      setStatus("offline");
      fail();
    };
  }

  function connectBinance() {
    const streams = pairs.map((p) => Sym.binance(p).toLowerCase() + "@trade").join("/");
    open(
      `wss://stream.binance.com:9443/stream?streams=${streams}`,
      "Binance",
      (raw) => {
        const msg = JSON.parse(raw);
        const data = msg.data || msg;
        if (!data || !data.s || !data.p) return;
        const pair = pairs.find((p) => Sym.binance(p) === data.s);
        if (pair) set(pair, data.p);
      },
      connectKraken
    );
  }

  function connectKraken() {
    open(
      "wss://ws.kraken.com/v2",
      "Kraken",
      (raw) => {
        const msg = JSON.parse(raw);
        if (msg.channel !== "ticker" || !Array.isArray(msg.data)) return;
        msg.data.forEach((row) => {
          const pair = pairs.find((p) => Sym.krakenWs(p) === row.symbol);
          if (pair && row.last != null) set(pair, row.last);
        });
      },
      retryLater,
      (socket) =>
        socket.send(
          JSON.stringify({
            method: "subscribe",
            params: { channel: "ticker", symbol: pairs.map(Sym.krakenWs) },
          })
        )
    );
  }

  // Entrambi giù: si riprova più tardi, aspettando sempre un po' di più (max 30s).
  function retryLater() {
    attempts += 1;
    setStatus("offline");
    const wait = Math.min(2000 * attempts, 30000);
    setTimeout(connect, wait);
  }

  function connect() {
    if (sock) {
      try {
        sock.close();
      } catch (e) {}
      sock = null;
    }
    setStatus("connecting");
    connectBinance();
  }

  /* ---------------- candele storiche ---------------- */

  const KRAKEN_INTERVAL = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240, "1d": 1440 };

  async function klines(pair, interval, startMs) {
    try {
      const url =
        `https://api.binance.com/api/v3/klines?symbol=${Sym.binance(pair)}` +
        `&interval=${interval}&startTime=${Math.floor(startMs)}&limit=1000`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("binance");
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) throw new Error("vuoto");
      return rows.map((r) => ({ t: r[0], c: parseFloat(r[4]) }));
    } catch (e) {
      return klinesKraken(pair, interval, startMs);
    }
  }

  async function klinesKraken(pair, interval, startMs) {
    try {
      const minutes = KRAKEN_INTERVAL[interval] || 60;
      const url =
        `https://api.kraken.com/0/public/OHLC?pair=${Sym.krakenRest(pair)}` +
        `&interval=${minutes}&since=${Math.floor(startMs / 1000)}`;
      const res = await fetch(url);
      const body = await res.json();
      const key = Object.keys(body.result || {}).find((k) => k !== "last");
      if (!key) return [];
      return body.result[key].map((r) => ({ t: r[0] * 1000, c: parseFloat(r[4]) }));
    } catch (e) {
      return [];
    }
  }

  /* ---------------- cambio euro ----------------

     Il bot ragiona in USDT, ma noi mostriamo tutto in euro: serve quanti
     euro vale un USDT. Il cambio si muove pochissimo, quindi basta
     chiederlo all'avvio e ogni mezz'ora, tenendo da parte l'ultimo buono. */

  const RATE_KEY = "portafoglio-bot.eurRate";
  const RATE_FALLBACK = 0.86; // usato solo se non abbiamo mai ottenuto un cambio
  let eurRate = Number(localStorage.getItem(RATE_KEY)) || null;

  function setRate(value) {
    if (!Number.isFinite(value) || value <= 0) return eurRate;
    eurRate = value;
    try {
      localStorage.setItem(RATE_KEY, String(value));
    } catch (e) {}
    onTick(prices); // il cambio è nuovo: ridisegna
    return eurRate;
  }

  async function fetchEurRate() {
    // Binance quota EURUSDT = quanti USDT vale 1 EUR: a noi serve l'inverso.
    try {
      const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT");
      if (!res.ok) throw new Error("binance");
      const price = Number((await res.json()).price);
      if (Number.isFinite(price) && price > 0) return setRate(1 / price);
    } catch (e) {
      /* si prova l'altra fonte */
    }
    // Ripiego: cambio ufficiale USD→EUR (USDT vale praticamente un dollaro).
    try {
      const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR");
      const body = await res.json();
      return setRate(Number(body && body.rates && body.rates.EUR));
    } catch (e) {
      return eurRate;
    }
  }

  /* ---------------- avvio ---------------- */

  function start(symbols, handlers) {
    pairs = symbols.slice();
    onTick = handlers.onTick || onTick;
    onStatus = handlers.onStatus || onStatus;

    snapshot();
    connect();
    fetchEurRate();
    setInterval(fetchEurRate, 30 * 60 * 1000);

    // Se per 90 secondi non arriva niente il socket è morto: si riparte.
    clearInterval(watchdog);
    watchdog = setInterval(() => {
      if (status === "live" && Date.now() - lastMessageAt > 90000) connect();
    }, 20000);

    // Tornando sull'app dopo che il telefono è stato in tasca.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && status !== "live") {
        snapshot();
        connect();
      }
    });

    window.addEventListener("online", connect);
  }

  return {
    start,
    klines,
    all: () => prices,
    get: (pair) => prices[pair],
    get status() {
      return status;
    },
    get source() {
      return source;
    },
    // Quanti euro vale 1 USDT (ripiego prudente finché non arriva il cambio vero).
    get eurRate() {
      return eurRate || RATE_FALLBACK;
    },
    get eurRateReady() {
      return eurRate != null;
    },
  };
})();
