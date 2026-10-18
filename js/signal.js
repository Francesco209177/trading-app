/* ============================================================
   "Cosa farà il bot?" — lo stesso ragionamento del bot, rifatto
   qui per mostrarlo a schermo.

   - Segnale (breakout Donchian, dal 18/10/2026): il bot confronta l'ultima
     chiusura giornaliera con il canale dei prezzi precedenti.
       sopra il massimo degli ultimi 55 giorni  -> compra
       sotto il minimo degli ultimi 20 giorni   -> vende
       in mezzo                                 -> non cambia nulla
   - Stop-loss: prezzo di carico meno l'8%. Il bot lo controlla
     ogni ora e, se scatta, vende subito.

   È una STIMA: il bot usa i prezzi di Kraken all'ora del suo
   controllo, qui usiamo le candele di Binance di adesso. Le due
   cose combaciano quasi sempre, ma la decisione vera resta sua.
   ============================================================ */

const Signal = (() => {
  const DAY = 24 * 3600 * 1000;
  const cache = {}; // pair -> { price, high, low }
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
        };
      })
    ).then(() => {
      loadedAt = Date.now();
      loading = null;
    });
    return loading;
  }

  // null finché le candele non sono arrivate.
  function of(pair) {
    const c = cache[pair];
    if (!c) return null;
    const signal = c.price > c.high ? "long" : c.price < c.low ? "flat" : "keep";
    return { price: c.price, high: c.high, low: c.low, signal };
  }

  // Cosa farà, detto a parole.
  // stopped = il bot è uscito con lo stop-loss: prima deve uscire dal canale (sotto il minimo)
  // e poi rompere di nuovo il massimo.
  function intent(pair, held, stopped) {
    const s = of(pair);
    if (!s) return null;
    if (held) return s.signal === "flat" ? { text: "venderà a breve", cls: "down" } : { text: "resta investito", cls: "up" };
    if (stopped && s.signal === "long") return { text: "aspetta un nuovo segnale", cls: "" };
    return s.signal === "long" ? { text: "comprerà alle 8", cls: "up" } : { text: "resta fuori", cls: "" };
  }

  function stopPrice(pos) {
    return pos.entry_price * (1 - CONFIG.strategy.stopLossPct);
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
