/* ============================================================
   Configurazione dell'app. È l'unico file da toccare se un
   giorno cambi repo, oppure se il bot inizia a tradare altre
   coppie oltre a BTC ed ETH.
   ============================================================ */

const CONFIG = {
  // Dove sta lo stato del bot (repo PRIVATO: si legge con la chiave).
  owner: "Francesco209177",
  repo: "trading-bot",
  path: "state/portfolio.json",

  // Valuta in cui il bot tiene i conti (deve combaciare con config.yaml del bot).
  quote: "USDT",

  // Valuta mostrata a schermo: convertiamo tutto in euro col cambio del momento.
  display: "€",

  // Regole del bot, per mostrare stop-loss e segnale delle medie.
  // Devono combaciare con strategy/risk in config.yaml del bot.
  strategy: { fast: 20, slow: 50, stopLossPct: 0.08 },

  // Ogni quanto richiedere lo stato aggiornato al repo (il bot lo aggiorna al massimo ogni ora).
  refreshMs: 60_000,

  // Chiavi usate nel localStorage di questo dispositivo.
  storage: { token: "portafoglio-bot.token" },
};

/* ------------------------------------------------------------
   Traduzione dei nomi delle coppie tra i vari servizi.
   Il bot le chiama "BTC/USDT"; Binance vuole "BTCUSDT";
   Kraken (nelle API REST) chiama il bitcoin "XBT".
   ------------------------------------------------------------ */

const Sym = {
  base: (pair) => pair.split("/")[0],
  quote: (pair) => pair.split("/")[1],
  binance: (pair) => pair.replace("/", "").toUpperCase(),
  krakenWs: (pair) => pair.toUpperCase(),
  krakenRest: (pair) => pair.replace("/", "").replace("BTC", "XBT").toUpperCase(),
};

/* ------------------------------------------------------------
   Formattatori italiani (1.013,89 invece di 1,013.89).
   ------------------------------------------------------------ */

const Fmt = {
  money: (n, dec = 2) =>
    // useGrouping "always": in italiano 1038 resterebbe senza punto, noi vogliamo 1.038.
    new Intl.NumberFormat("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: "always" }).format(n),

  signed: (n, dec = 2) => (n >= 0 ? "+" : "−") + Fmt.money(Math.abs(n), dec),

  pct: (n) => (n >= 0 ? "+" : "−") + Fmt.money(Math.abs(n), 2) + "%",

  // I prezzi grossi (BTC) non hanno bisogno dei centesimi, quelli piccoli sì.
  price: (n) => Fmt.money(n, n >= 1000 ? 0 : n >= 1 ? 2 : 6),

  // Importo con la valuta, sempre uguale in tutta l'app: "1.013,89 €".
  cur: (n, dec = 2) => Fmt.money(n, dec) + " " + CONFIG.display,

  signedCur: (n, dec = 2) => Fmt.signed(n, dec) + " " + CONFIG.display,

  qty: (n) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 }).format(n),

  time: (d) => d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),

  dateTime: (d) =>
    d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) + " " + Fmt.time(d),
};
