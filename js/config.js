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

  // Valuta in cui è espresso il capitale (deve combaciare con config.yaml del bot).
  quote: "USDT",

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
    new Intl.NumberFormat("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n),

  signed: (n, dec = 2) => (n >= 0 ? "+" : "−") + Fmt.money(Math.abs(n), dec),

  pct: (n) => (n >= 0 ? "+" : "−") + Fmt.money(Math.abs(n), 2) + "%",

  // I prezzi grossi (BTC) non hanno bisogno dei centesimi, quelli piccoli sì.
  price: (n) => Fmt.money(n, n >= 1000 ? 0 : n >= 1 ? 2 : 6),

  qty: (n) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 }).format(n),

  time: (d) => d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),

  dateTime: (d) =>
    d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) + " " + Fmt.time(d),
};
