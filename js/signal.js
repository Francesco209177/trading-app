/* ============================================================
   "Cosa farà il bot?" — lo stesso ragionamento del bot, rifatto
   qui per mostrarlo a schermo.

   - Segnale (breakout Donchian, dal 18/10/2026): il bot confronta l'ultima
     chiusura giornaliera con il canale dei prezzi precedenti.
       sopra il massimo degli ultimi 55 giorni  -> compra
       sotto il minimo degli ultimi 20 giorni   -> vende
       in mezzo                                 -> non cambia nulla
     Scoperto (dal 27/10/2026, solo BTC ed ETH): la stessa regola al contrario.
       sotto il minimo degli ultimi 55 giorni   -> vende allo scoperto
       sopra il massimo degli ultimi 20 giorni  -> chiude lo scoperto
   - Stop-loss: l'8% contro la posizione (sotto il carico per un acquisto,
     sopra il prezzo di vendita per uno scoperto). Il bot lo controlla
     ogni ora e, se scatta, chiude subito.

   È una STIMA: il bot usa i prezzi di Kraken all'ora del suo
   controllo, qui usiamo le candele di Binance di adesso. Le due
   cose combaciano quasi sempre, ma la decisione vera resta sua.
   ============================================================ */

const Signal = (() => {
  const DAY = 24 * 3600 * 1000;
  const cache = {}; // pair -> { price, high, low, lowN, highM }
  let loadedAt = 0;
  let loading = null;

  // Scarica le candele giornaliere e ricalcola il canale.
  function refresh(pairs) {
    if (loading) return loading;
    const { entry, exit } = CONFIG.strategy;
    const from = Date.now() - (entry + 15) * DAY;
    loading = Promise.all(
      pairs.map(async (pair) => {
        const rows = await Prices.klines(pair, "1d", from);
        // L'ultima candela è quella di oggi, ancora aperta: il bot guarda solo le chiuse.
        const closes = rows.slice(0, -1).map((r) => r.c);
        if (closes.length < entry + 1) return;
        const price = closes[closes.length - 1];
        const before = closes.slice(0, -1); // le candele PRECEDENTI all'ultima
        cache[pair] = {
          price,
          high: Math.max(...before.slice(-entry)),
          low: Math.min(...before.slice(-exit)),
          lowN: Math.min(...before.slice(-entry)), // sotto qui: scoperto
          highM: Math.max(...before.slice(-exit)), // sopra qui: chiude lo scoperto
        };
      })
    ).then(() => {
      loadedAt = Date.now();
      loading = null;
    });
    return loading;
  }

  // null finché le candele non sono arrivate.
  const canShort = (pair) => (CONFIG.strategy.shortable || []).includes(pair);

  function of(pair) {
    const c = cache[pair];
    if (!c) return null;
    const short = canShort(pair);
    const signal =
      c.price > c.high ? "long" : short && c.price < c.lowN ? "short" : c.price < c.low ? "flat" : "keep";
    return { price: c.price, high: c.high, low: c.low, lowN: c.lowN, highM: c.highM, canShort: short, signal };
  }

  // Cosa farà, detto a parole.
  // pos = la posizione del bot (o null); stopped = è uscito con lo stop-loss
  // ("long"/"short", o true dai dati vecchi): prima di rientrare nella stessa
  // direzione il prezzo deve uscire dal canale dalla parte opposta.
  function intent(pair, pos, stopped) {
    const s = of(pair);
    if (!s) return null;
    if (pos && pos.qty < 0) {
      if (s.signal === "long") return { text: "girerà in acquisto", cls: "up" };
      return s.price > s.highM ? { text: "chiuderà lo scoperto", cls: "down" } : { text: "resta allo scoperto", cls: "up" };
    }
    if (pos) {
      if (s.signal === "short") return { text: "girerà allo scoperto", cls: "down" };
      return s.signal === "flat" ? { text: "venderà a breve", cls: "down" } : { text: "resta investito", cls: "up" };
    }
    const stopDir = stopped === true ? "long" : stopped;
    if (stopDir && s.signal === stopDir) return { text: "aspetta un nuovo segnale", cls: "" };
    if (s.signal === "long") return { text: "comprerà alle 8", cls: "up" };
    if (s.signal === "short") return { text: "venderà allo scoperto alle 8", cls: "up" };
    return { text: "resta fuori", cls: "" };
  }

  function stopPrice(pos) {
    const k = CONFIG.strategy.stopLossPct;
    return pos.qty < 0 ? pos.entry_price * (1 + k) : pos.entry_price * (1 - k);
  }

  return {
    refresh,
    of,
    intent,
    stopPrice,
    get ready() {
      return loadedAt > 0;
    },
  };
})();
