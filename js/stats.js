/* ============================================================
   I conti sopra i conti: quanto ha reso davvero il bot finora.

   Tre domande, tre funzioni:
   - Delle operazioni fatte, quali sono "chiuse" (comprato e poi
     rivenduto) e quanto hanno reso? closedTrades()
   - Qual è stato il giorno migliore e il peggiore? dailyExtremes()
   - Il bot sta facendo meglio o peggio di uno che avesse comprato
     il primo giorno e non avesse più toccato nulla? buyAndHold()

   Nessuna di queste tocca i dati del bot: sono tutte ricavate da
   quello che il bot già registra (trades, history).
   ============================================================ */

const Stats = (() => {
  // Accoppia acquisti e vendite per ogni moneta in ordine cronologico
  // (FIFO: la prima vendita chiude la quantità comprata per prima).
  // Generico: funziona con 2 operazioni chiuse come con 200.
  function closedTrades(state) {
    const bySymbol = {};
    (state.trades || [])
      .slice()
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .forEach((t) => (bySymbol[t.symbol] = bySymbol[t.symbol] || []).push(t));

    const closed = [];

    Object.entries(bySymbol).forEach(([symbol, trades]) => {
      const open = []; // lotti ancora aperti: { qty, price, fee, time }

      trades.forEach((t) => {
        if (t.side === "BUY") {
          open.push({ qty: t.qty, price: t.price, fee: t.fee || 0, time: t.time });
          return;
        }
        let remaining = t.qty;
        const sellFeePerUnit = t.qty ? (t.fee || 0) / t.qty : 0;

        while (remaining > 1e-12 && open.length) {
          const lot = open[0];
          const matched = Math.min(lot.qty, remaining);
          const buyFeeShare = lot.qty ? (lot.fee * matched) / lot.qty : 0;
          const sellFeeShare = sellFeePerUnit * matched;
          const pl = matched * (t.price - lot.price) - buyFeeShare - sellFeeShare;

          closed.push({
            symbol,
            qty: matched,
            entryTime: lot.time,
            exitTime: t.time,
            entryPrice: lot.price,
            exitPrice: t.price,
            pl,
            plPct: lot.price ? (t.price / lot.price - 1) * 100 : 0,
          });

          lot.qty -= matched;
          remaining -= matched;
          if (lot.qty <= 1e-12) open.shift();
        }
      });
    });

    return closed.sort((a, b) => new Date(a.exitTime) - new Date(b.exitTime));
  }

  // Variazione giorno su giorno dagli scatti giornalieri del bot:
  // il migliore e il peggiore da quando è partito.
  function dailyExtremes(state) {
    const h = (state.history || []).slice().sort((a, b) => new Date(a.time) - new Date(b.time));
    let best = null;
    let worst = null;

    for (let i = 1; i < h.length; i++) {
      if (!h[i - 1].equity) continue;
      const pct = (h[i].equity / h[i - 1].equity - 1) * 100;
      const row = { time: h[i].time, pct, from: h[i - 1].equity, to: h[i].equity };
      if (!best || pct > best.pct) best = row;
      if (!worst || pct < worst.pct) worst = row;
    }
    return { best, worst };
  }

  // Se il bot avesse comprato le prime quantità di ogni moneta il primo
  // giorno e non avesse mai più toccato nulla (niente ribilanciamenti):
  // quanto varrebbe oggi? Risponde a "sta facendo meglio del non far niente?".
  function buyAndHold(state, prices) {
    const firstBuy = {};
    (state.trades || [])
      .slice()
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .forEach((t) => {
        if (t.side === "BUY" && !firstBuy[t.symbol]) firstBuy[t.symbol] = t;
      });

    let spent = 0;
    let value = 0;
    const positions = {};

    Object.entries(firstBuy).forEach(([symbol, t]) => {
      spent += t.qty * t.price + (t.fee || 0);
      const price = prices[symbol] != null ? prices[symbol] : t.price;
      value += t.qty * price;
      positions[symbol] = { qty: t.qty, entryPrice: t.price, price };
    });

    const cashLeft = state.start_equity - spent;
    return { value: cashLeft + value, cashLeft, positions };
  }

  // Differenze minuscole non sono "peggio" o "meglio": sotto lo 0,5% del
  // capitale iniziale le consideriamo in linea (niente rosso che allarma).
  function versus(diff, startEquity) {
    const small = Math.abs(diff) < startEquity * 0.005;
    return { cls: small ? "" : diff >= 0 ? "up" : "down", small };
  }

  return { closedTrades, dailyExtremes, buyAndHold, versus };
})();
