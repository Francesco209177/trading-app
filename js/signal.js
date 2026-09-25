/* ============================================================
   "Cosa farà il bot?" — lo stesso ragionamento del bot, rifatto
   qui per mostrarlo a schermo.

   - Segnale: media dei prezzi di chiusura degli ultimi 20 giorni
     contro quella degli ultimi 50. Veloce sopra lenta = trend
     rialzista (il bot sta dentro), sotto = ribassista (esce).
   - Stop-loss: prezzo di carico meno l'8%. Il bot lo controlla
     ogni ora e, se scatta, vende subito.

   È una STIMA: il bot usa i prezzi di Kraken all'ora del suo
   controllo, qui usiamo le candele di Binance di adesso. Le due
   cose combaciano quasi sempre, ma la decisione vera resta sua.
   ============================================================ */

const Signal = (() => {
  const DAY = 24 * 3600 * 1000;
  const cache = {}; // pair -> { fast, slow }
  let loadedAt = 0;
  let loading = null;

  function sma(values, period) {
    if (values.length < period) return null;
    let sum = 0;
    for (let i = values.length - period; i < values.length; i++) sum += values[i];
    return sum / period;
  }

  // Scarica le candele giornaliere e ricalcola le due medie.
  function refresh(pairs) {
    if (loading) return loading;
    const from = Date.now() - (CONFIG.strategy.slow + 15) * DAY;
    loading = Promise.all(
      pairs.map(async (pair) => {
        const rows = await Prices.klines(pair, "1d", from);
        const closes = rows.map((r) => r.c);
        cache[pair] = { fast: sma(closes, CONFIG.strategy.fast), slow: sma(closes, CONFIG.strategy.slow) };
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
    if (!c || c.fast == null || c.slow == null) return null;
    return { fast: c.fast, slow: c.slow, up: c.fast > c.slow, gapPct: (c.fast / c.slow - 1) * 100 };
  }

  // Cosa farà alla prossima analisi delle 8, detto a parole.
  function intent(pair, held) {
    const s = of(pair);
    if (!s) return null;
    if (held) return s.up ? { text: "resta investito", cls: "up" } : { text: "venderà alle 8", cls: "down" };
    return s.up ? { text: "comprerà alle 8", cls: "up" } : { text: "resta fuori", cls: "" };
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
