/* ============================================================
   Modalità demo: per chi apre il sito senza la chiave.

   Costruisce un portafoglio INVENTATO ma verosimile, usando i
   prezzi VERI degli ultimi 45 giorni: 1.000 USDT di partenza,
   BTC ed ETH comprati il primo giorno col 25% ciascuno, ETH
   venduto e ricomprato una volta (così anche Statistiche ha
   qualcosa da mostrare). Nessun dato del bot vero viene letto.
   ============================================================ */

const Demo = (() => {
  const TOKEN = "__demo__"; // non è una chiave: dice all'app di usare questi dati
  const DAY = 24 * 3600 * 1000;
  const PAIRS = ["BTC/USDT", "ETH/USDT"];
  const FEE = 0.001;

  let state = null;
  let served = false;

  async function build() {
    const start = Date.now() - 45 * DAY;
    const candles = {};
    await Promise.all(PAIRS.map(async (p) => (candles[p] = await Prices.klines(p, "1d", start))));
    const days = Math.min(...PAIRS.map((p) => candles[p].length));
    if (days < 20) throw new AuthError("Non riesco a scaricare i prezzi per la demo. Riprova tra poco.");

    let cash = 1000;
    const pos = {};
    const trades = [];
    const history = [];
    const at = (p, i) => candles[p][i];
    // Le operazioni avvengono "alle 8 italiane" del giorno della candela.
    const when = (i) => new Date(at(PAIRS[0], i).t + 6 * 3600 * 1000).toISOString();

    function buy(p, i, value) {
      const price = at(p, i).c;
      const qty = value / price;
      const fee = value * FEE;
      cash -= value + fee;
      pos[p] = { qty, entry_price: price, entry_time: when(i) };
      trades.push({ time: when(i), symbol: p, side: "BUY", qty, price, fee, value });
    }

    function sell(p, i) {
      const price = at(p, i).c;
      const qty = pos[p].qty;
      const value = qty * price;
      const fee = value * FEE;
      cash += value - fee;
      delete pos[p];
      trades.push({ time: when(i), symbol: p, side: "SELL", qty, price, fee, value });
    }

    for (let i = 0; i < days; i++) {
      if (i === 0) PAIRS.forEach((p) => buy(p, 0, 250));
      if (i === 12) sell("ETH/USDT", 12);
      if (i === 19) buy("ETH/USDT", 19, 250);

      let equity = cash;
      Object.entries(pos).forEach(([p, x]) => (equity += x.qty * at(p, i).c));
      history.push({ time: when(i), equity: Math.round(equity * 100) / 100 });
    }

    return { cash, start_equity: 1000, positions: pos, history, trades };
  }

  // Stessa forma di GitHub.load(): l'app non si accorge della differenza.
  async function load() {
    if (!state) state = await build();
    const changed = !served;
    served = true;
    return { changed, state, at: new Date() };
  }

  return {
    TOKEN,
    load,
    is: (token) => token === TOKEN,
  };
})();
