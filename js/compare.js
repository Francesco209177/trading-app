/* ============================================================
   Pagina Confronto: BTC ed ETH separati, ognuno col suo grafico
   di prezzo (non il valore del portafoglio: qui interessa la
   moneta in sé, per vedere quale delle due sta tirando di più).
   ============================================================ */

const Compare = (() => {
  const boxes = {
    "BTC/USDT": { chartEl: "chartBtc", infoEl: "compareBtcInfo", name: "Bitcoin" },
    "ETH/USDT": { chartEl: "chartEth", infoEl: "compareEthInfo", name: "Ethereum" },
  };
  const eur = Currency.eur;

  const charts = {}; // symbol -> istanza Chart
  let built = false;
  let pollTimer = null;

  function build() {
    Object.entries(boxes).forEach(([symbol, box]) => {
      const el = document.getElementById(box.chartEl);
      if (el) charts[symbol] = Chart.create(el);
    });
    built = true;
  }

  async function loadChart(symbol) {
    const state = App.getState();
    const chart = charts[symbol];
    if (!state || !chart) return;

    const { from, interval } = Equity.view(state, "TUTTO");
    const candles = await Prices.klines(symbol, interval, from);
    if (!candles.length) return;

    chart.setData(candles.map((c) => ({ time: Math.floor(c.t / 1000), value: eur(c.c) })));
  }

  function renderInfo() {
    const state = App.getState();
    if (!state) return;
    const prices = Prices.all();

    Object.entries(boxes).forEach(([symbol, box]) => {
      const info = document.getElementById(box.infoEl);
      if (!info) return;

      const pos = state.positions && state.positions[symbol];
      const s = Signal.of(symbol);
      // Le due medie del bot: la distanza dice quanto manca a un incrocio.
      const medie = s
        ? `<div class="compare-row">
             <span>Media ${CONFIG.strategy.fast}g ${Fmt.price(eur(s.fast))} · ${CONFIG.strategy.slow}g ${Fmt.price(eur(s.slow))}&nbsp;${CONFIG.display}</span>
             <span class="${s.up ? "up" : "down"}">${s.up ? "▲ rialzista" : "▼ ribassista"} (${Fmt.pct(s.gapPct)})</span>
           </div>`
        : "";

      if (!pos) {
        info.innerHTML = `<div class="compare-row"><span>Nessuna posizione aperta</span></div>` + medie;
        return;
      }
      const price = prices[symbol] != null ? prices[symbol] : pos.entry_price;
      const plPct = pos.entry_price ? (price / pos.entry_price - 1) * 100 : 0;

      info.innerHTML = `
        <div class="compare-row">
          <span>Carico ${Fmt.price(eur(pos.entry_price))} → ${Fmt.price(eur(price))}&nbsp;${CONFIG.display}</span>
          <span class="${plPct >= 0 ? "up" : "down"}">${Fmt.pct(plPct)}</span>
        </div>
        ${medie}
      `;
    });
  }

  function enter(alreadyEntered) {
    if (!built) build();
    if (!Signal.ready) Signal.refresh(Object.keys(boxes)).then(renderInfo);
    if (!alreadyEntered) {
      Object.keys(boxes).forEach(loadChart);
    }
    renderInfo();

    // Mentre la pagina è aperta, i prezzi si aggiornano un paio di volte al secondo.
    clearInterval(pollTimer);
    pollTimer = setInterval(renderInfo, 500);
  }

  // Appena si cambia pagina, si smette di lavorare per niente su una vista nascosta.
  function leave() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  Router.register("compare", "view-compare", enter, leave);
})();
