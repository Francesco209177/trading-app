/* ============================================================
   Pagina Statistiche: i numeri di js/stats.js, disegnati.
   ============================================================ */

const StatsView = (() => {
  const el = { content: document.getElementById("statsContent") };
  const eur = Currency.eur;
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

  function tile(label, value, cls) {
    return `<div class="stat-tile">
      <div class="label">${label}</div>
      <div class="value${cls ? " " + cls : ""}">${value}</div>
    </div>`;
  }

  // Una barra per ogni operazione chiusa: sopra la riga se in guadagno,
  // sotto se in perdita. Con poche chiusure è essenziale, ma è pensato
  // per restare leggibile anche quando ce ne saranno decine.
  function plChart(closed) {
    if (!closed.length) return "";
    const values = closed.map((c) => eur(c.pl));
    const maxAbs = Math.max(...values.map(Math.abs)) || 1;

    const cols = closed
      .map((c, i) => {
        const v = values[i];
        const pct = (Math.abs(v) / maxAbs) * 46; // lascia margine sopra/sotto la linea dello zero
        const cls = v >= 0 ? "up" : "down";
        const label = new Date(c.exitTime).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
        return `<div class="pl-col" title="${esc(Sym.base(c.symbol))} · ${esc(Fmt.signed(v))}&nbsp;${CONFIG.display}">
          <div class="pl-bar ${cls}" style="height:${pct}%"></div>
          <div class="pl-label">${esc(label)}</div>
        </div>`;
      })
      .join("");

    return `<div class="pl-chart">${cols}</div>`;
  }

  function render() {
    const state = App.getState();
    if (!state) {
      el.content.innerHTML = `<p class="empty">Ancora nessun dato dal bot.</p>`;
      return;
    }

    const prices = Prices.all();
    const live = Equity.now(state, prices);
    const closed = Stats.closedTrades(state);
    const wins = closed.filter((c) => c.pl > 0).length;
    const realized = closed.reduce((sum, c) => sum + c.pl, 0);
    const { best, worst } = Stats.dailyExtremes(state);
    const bh = Stats.buyAndHold(state, prices);
    const vsBh = live - bh.value;
    const total = live - state.start_equity;

    const tiles = [
      tile(
        "Da inizio",
        `${Fmt.signedCur(eur(total))}<br><small>${Fmt.pct((total / state.start_equity) * 100)}</small>`,
        total >= 0 ? "up" : "down"
      ),
      tile(
        "Operazioni chiuse",
        closed.length ? `${closed.length} · ${wins} in guadagno` : "Nessuna ancora",
        closed.length && wins === closed.length ? "up" : closed.length && wins === 0 ? "down" : ""
      ),
      tile(
        "Guadagno realizzato",
        closed.length ? Fmt.signedCur(eur(realized)) : "—",
        realized > 0 ? "up" : realized < 0 ? "down" : ""
      ),
      tile(
        "Rispetto a comprare e tenere",
        Stats.versus(vsBh, state.start_equity).small ? `In linea<br><small>${Fmt.signedCur(eur(vsBh))}</small>` : Fmt.signedCur(eur(vsBh)),
        Stats.versus(vsBh, state.start_equity).cls
      ),
      tile(
        "Giorno migliore",
        best ? `${Fmt.pct(best.pct)} · ${Fmt.dateTime(new Date(best.time))}` : "—",
        best && best.pct >= 0 ? "up" : ""
      ),
      tile(
        "Giorno peggiore",
        worst ? `${Fmt.pct(worst.pct)} · ${Fmt.dateTime(new Date(worst.time))}` : "—",
        worst && worst.pct < 0 ? "down" : ""
      ),
    ];

    const closedRows = closed.length
      ? closed
          .slice()
          .reverse()
          .map(
            (c) => `
        <div class="trade">
          <div class="trade-side ${c.pl >= 0 ? "buy" : "sell"}">${c.pl >= 0 ? "↑" : "↓"}</div>
          <div class="trade-main">
            <div class="trade-title">${Sym.base(c.symbol)} · ${Fmt.dateTime(new Date(c.entryTime))} → ${Fmt.dateTime(new Date(c.exitTime))}</div>
            <div class="trade-sub">${Fmt.price(eur(c.entryPrice))} → ${Fmt.price(eur(c.exitPrice))}&nbsp;${CONFIG.display} (${Fmt.pct(c.plPct)})</div>
          </div>
          <div class="trade-val ${c.pl >= 0 ? "up" : "down"}">${Fmt.signedCur(eur(c.pl))}</div>
        </div>`
          )
          .join("")
      : `<p class="empty">Il bot non ha ancora chiuso nessuna operazione: tiene tutto da quando è partito.</p>`;

    el.content.innerHTML = `
      <div class="stat-grid">${tiles.join("")}</div>
      <h2>Operazioni chiuse</h2>
      ${plChart(closed)}
      ${closedRows}
      <p class="stat-note">
        "Comprare e tenere" = se il bot avesse comprato le prime quantità di BTC ed ETH
        il primo giorno e non avesse più toccato nulla. Serve a capire se muoversi ha
        aiutato o no.
      </p>
    `;
  }

  function enter() {
    render();
  }

  Router.register("stats", "view-stats", enter);
})();
