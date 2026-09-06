/* ============================================================
   I conti del portafoglio.

   L'idea di tutta l'app sta in una riga:
       valore = liquidità + Σ (quantità × prezzo attuale)

   Il bot ci dà liquidità e quantità (che cambiano solo quando opera),
   il mercato ci dà i prezzi (che cambiano di continuo): il numero che
   sale e scende nasce da qui, non è inventato.

   Per il grafico del passato ricostruiamo la stessa formula minuto per
   minuto, usando le operazioni registrate dal bot e le candele storiche.
   ============================================================ */

const Equity = (() => {
  /* ---------------- adesso ---------------- */

  function now(state, prices) {
    if (!state) return null;
    let total = state.cash;
    Object.entries(state.positions || {}).forEach(([sym, pos]) => {
      const price = prices[sym] != null ? prices[sym] : pos.entry_price;
      total += pos.qty * price;
    });
    return total;
  }

  function positions(state, prices) {
    return Object.entries(state.positions || {}).map(([sym, pos]) => {
      const price = prices[sym] != null ? prices[sym] : pos.entry_price;
      const value = pos.qty * price;
      const cost = pos.qty * pos.entry_price;
      return {
        symbol: sym,
        qty: pos.qty,
        entry: pos.entry_price,
        price,
        value,
        pl: value - cost,
        plPct: cost ? ((value - cost) / cost) * 100 : 0,
        live: prices[sym] != null,
      };
    });
  }

  // Ultimo valore registrato dal bot (lo scatto del resoconto delle 8:00).
  function lastSnapshot(state) {
    const history = state.history || [];
    return history.length ? history[history.length - 1] : null;
  }

  /* ---------------- ricostruzione del passato ----------------

     Dalle operazioni ricaviamo la fotografia esatta di liquidità e
     quantità in ogni istante: si parte dai 1.000 USDT iniziali e si
     applica una per una ogni compravendita, commissioni comprese. */

  function timeline(state) {
    const steps = [{ t: 0, cash: state.start_equity, pos: {} }];
    const trades = (state.trades || [])
      .slice()
      .sort((a, b) => new Date(a.time) - new Date(b.time));

    let cash = state.start_equity;
    const pos = {};

    trades.forEach((tr) => {
      const value = tr.qty * tr.price;
      const fee = tr.fee || 0;
      if (tr.side === "BUY") {
        cash -= value + fee;
        pos[tr.symbol] = (pos[tr.symbol] || 0) + tr.qty;
      } else {
        cash += value - fee;
        pos[tr.symbol] = (pos[tr.symbol] || 0) - tr.qty;
        if (pos[tr.symbol] < 1e-12) delete pos[tr.symbol];
      }
      steps.push({ t: new Date(tr.time).getTime(), cash, pos: Object.assign({}, pos) });
    });

    // La liquidità di adesso la prendiamo da chi la sa davvero (il bot),
    // così la fine del grafico combacia al centesimo con il numero grande.
    steps[steps.length - 1].cash = state.cash;
    return steps;
  }

  /* Costruisce la serie del grafico: per ogni candela applica la formula
     con le quantità che il bot aveva in quel momento. */
  function series(state, candlesBySymbol, fromMs) {
    const steps = timeline(state);
    const symbols = Object.keys(candlesBySymbol).filter((s) => candlesBySymbol[s].length);
    if (!symbols.length) return [];

    // Asse dei tempi: l'unione dei momenti di tutte le candele.
    const times = new Set();
    symbols.forEach((s) => candlesBySymbol[s].forEach((c) => times.add(c.t)));
    const axis = Array.from(times)
      .sort((a, b) => a - b)
      .filter((t) => t >= fromMs);

    const cursor = {};
    const lastPrice = {};
    symbols.forEach((s) => (cursor[s] = 0));

    const out = [];
    let step = 0;

    axis.forEach((t) => {
      while (step + 1 < steps.length && steps[step + 1].t <= t) step += 1;
      const snap = steps[step];

      // Prezzo valido a quel momento (l'ultimo conosciuto fino a lì).
      symbols.forEach((s) => {
        const rows = candlesBySymbol[s];
        while (cursor[s] < rows.length && rows[cursor[s]].t <= t) {
          lastPrice[s] = rows[cursor[s]].c;
          cursor[s] += 1;
        }
      });

      let value = snap.cash;
      let complete = true;
      Object.entries(snap.pos).forEach(([sym, qty]) => {
        if (qty <= 0) return;
        if (lastPrice[sym] == null) complete = false;
        else value += qty * lastPrice[sym];
      });

      if (complete) out.push({ time: Math.floor(t / 1000), value: Math.round(value * 100) / 100 });
    });

    return out;
  }

  /* ---------------- intervalli del grafico ---------------- */

  const RANGES = {
    "1G": { spanMs: 24 * 3600 * 1000 },
    "1S": { spanMs: 7 * 24 * 3600 * 1000 },
    "1M": { spanMs: 30 * 24 * 3600 * 1000 },
    TUTTO: { spanMs: null }, // dall'inizio della simulazione
  };

  // Candele fitte per periodi corti, larghe per periodi lunghi.
  // Usiamo solo intervalli che esistono sia su Binance sia su Kraken.
  function pickInterval(spanMs) {
    const days = spanMs / (24 * 3600 * 1000);
    if (days <= 2) return "5m";
    if (days <= 7) return "15m";
    if (days <= 21) return "1h";
    if (days <= 60) return "4h";
    return "1d";
  }

  // Da quando parte il grafico e con che passo (evitiamo il nome 'window': è già del browser).
  function view(state, rangeKey) {
    const range = RANGES[rangeKey] || RANGES.TUTTO;
    const startedAt = firstEventMs(state);
    const from = range.spanMs ? Math.max(Date.now() - range.spanMs, startedAt) : startedAt;
    return { from, interval: pickInterval(Math.max(Date.now() - from, 3600 * 1000)) };
  }

  function firstEventMs(state) {
    const times = []
      .concat((state.trades || []).map((t) => new Date(t.time).getTime()))
      .concat((state.history || []).map((h) => new Date(h.time).getTime()))
      .filter((n) => Number.isFinite(n));
    // Un'ora di margine prima del primo evento: si vede la riga piatta di partenza.
    return times.length ? Math.min.apply(null, times) - 3600 * 1000 : Date.now() - 24 * 3600 * 1000;
  }

  return { now, positions, lastSnapshot, timeline, series, view, RANGES };
})();
