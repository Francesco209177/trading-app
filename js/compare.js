/* ============================================================
   Pagina Confronto: BTC ed ETH separati, ognuno col suo grafico
   di prezzo (non il valore del portafoglio: qui interessa la
   moneta in sé, per vedere quale delle due sta tirando di più).
   ============================================================ */

const Compare = (() => {
  const boxes = {
    "BTC/USDT": { chartEl: "chartBtc", infoEl: "compareBtcInfo", name: "Bitcoin" },
    "ETH/USDT": { chartEl: "chartEth", infoEl: "compareEthInfo", name: "Ethereum" },
    "PAXG/USD": { chartEl: "chartGold", infoEl: "compareGoldInfo", name: "Oro" },
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
      const live = prices[symbol] != null ? prices[symbol] : pos ? pos.entry_price : null;
      // Il canale del bot: quanto manca al prezzo per comprare (massimo), per uscire
      // (minimo) o, sulle monete con lo scoperto, per vendere allo scoperto o chiuderlo.
      let medie = "";
      if (s && live != null) {
        const { entry, exit } = CONFIG.strategy;
        const toLow = (live / s.low - 1) * 100;
        const toHigh = (s.high / live - 1) * 100;
        const toLowN = (live / s.lowN - 1) * 100;
        const toHighM = (s.highM / live - 1) * 100;
        let stato;
        let canale = `minimo ${exit}g ${Fmt.price(eur(s.low))} · massimo ${entry}g ${Fmt.price(eur(s.high))}`;
        if (pos && pos.qty < 0) {
          canale = `massimo ${exit}g ${Fmt.price(eur(s.highM))} · minimo ${entry}g ${Fmt.price(eur(s.lowN))}`;
          stato = toHighM > 0
            ? `<span>chiude lo scoperto se sale del ${Fmt.money(toHighM, 1)}%</span>`
            : `<span class="down">sopra il massimo: chiude lo scoperto</span>`;
        } else if (pos) {
          stato = toLow > 0
            ? `<span>esce se scende del ${Fmt.money(toLow, 1)}%</span>`
            : `<span class="down">sotto il minimo: esce</span>`;
        } else if (s.canShort) {
          canale = `minimo ${entry}g ${Fmt.price(eur(s.lowN))} · massimo ${entry}g ${Fmt.price(eur(s.high))}`;
          stato = toHigh <= 0
            ? `<span class="up">sopra il massimo: compra</span>`
            : toLowN <= 0
            ? `<span class="up">sotto il minimo: scoperto</span>`
            : `<span>compra se sale del ${Fmt.money(toHigh, 1)}% · scoperto se scende del ${Fmt.money(toLowN, 1)}%</span>`;
        } else {
          stato = toHigh > 0
            ? `<span>compra se sale del ${Fmt.money(toHigh, 1)}%</span>`
            : `<span class="up">sopra il massimo: compra</span>`;
        }
        medie = `<div class="compare-row">
             <span>Canale: ${canale}&nbsp;${CONFIG.display}</span>
             ${stato}
           </div>`;
      }

      if (!pos) {
        info.innerHTML = `<div class="compare-row"><span>Nessuna posizione aperta</span></div>` + medie;
        return;
      }
      const price = prices[symbol] != null ? prices[symbol] : pos.entry_price;
      const short = pos.qty < 0;
      // Scoperto: si guadagna se il prezzo scende.
      const plPct = pos.entry_price ? (price / pos.entry_price - 1) * 100 * (short ? -1 : 1) : 0;

      info.innerHTML = `
        <div class="compare-row">
          <span>${short ? "Scoperto: venduto a" : "Carico"} ${Fmt.price(eur(pos.entry_price))} → ${Fmt.price(eur(price))}&nbsp;${CONFIG.display}</span>
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
