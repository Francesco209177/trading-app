/* ============================================================
   Il regista: mette insieme stato del bot + prezzi live e
   disegna la schermata.
   ============================================================ */

const App = (() => {
  const el = {
    equity: document.getElementById("equity"),
    heroLabel: document.getElementById("heroLabel"),
    deltaDay: document.getElementById("deltaDay"),
    deltaTotal: document.getElementById("deltaTotal"),
    chart: document.getElementById("chart"),
    ranges: document.getElementById("ranges"),
    positions: document.getElementById("positions"),
    trades: document.getElementById("trades"),
    statusDot: document.getElementById("statusDot"),
    statusText: document.getElementById("statusText"),
    settings: document.getElementById("settings"),
    setRepo: document.getElementById("setRepo"),
    setSource: document.getElementById("setSource"),
    setUpdated: document.getElementById("setUpdated"),
  };

  const NAMES = { BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", XRP: "XRP", ADA: "Cardano" };

  let token = null;
  let state = null;
  let range = "TUTTO";
  let scrub = null;
  let seriesData = [];
  let lastPointTime = null;
  let rangeFirstValue = null;
  let previous = null;
  let painting = false;
  let flashTimer = null;
  let lastCardsPaint = 0;
  let tradesSignature = null;

  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const nameOf = (pair) => NAMES[Sym.base(pair)] || Sym.base(pair);

  /* ---------------- avvio ---------------- */

  async function start(key) {
    token = key;
    el.setRepo.textContent = `${CONFIG.owner}/${CONFIG.repo}`;

    const ok = await refreshState();
    if (!ok) return;

    Chart.create(el.chart, { onScrub: handleScrub });

    Prices.start(symbols(), {
      onTick: schedulePaint,
      onStatus: renderStatus,
    });

    await loadSeries();

    setInterval(refreshState, CONFIG.refreshMs);
    setInterval(loadSeries, 5 * 60 * 1000); // nuove candele
    setInterval(renderStatus, 30 * 1000);

    wireButtons();
    paint();
  }

  // Tutte le coppie che ci interessano: quelle aperte adesso più quelle già tradate.
  function symbols() {
    const set = new Set(Object.keys(state.positions || {}));
    (state.trades || []).forEach((t) => set.add(t.symbol));
    return Array.from(set);
  }

  /* ---------------- dati dal bot ---------------- */

  async function refreshState() {
    try {
      const res = await GitHub.load(token);
      const changed = res.changed;
      state = res.state;
      if (changed && Chart.ready) loadSeries();
      schedulePaint();
      renderStatus();
      return true;
    } catch (err) {
      if (err instanceof AuthError) {
        Gate.reject(err.message);
        return false;
      }
      renderStatus(); // rete assente: si continua con l'ultimo stato noto
      return true;
    }
  }

  /* ---------------- grafico ---------------- */

  async function loadSeries() {
    if (!state || !Chart.ready) return;
    const { from, interval } = Equity.view(state, range);

    const candles = {};
    await Promise.all(
      symbols().map(async (pair) => {
        candles[pair] = await Prices.klines(pair, interval, from - 2 * 3600 * 1000);
      })
    );

    seriesData = Equity.series(state, candles, from);
    if (!seriesData.length) return;

    rangeFirstValue = seriesData[0].value;
    lastPointTime = seriesData[seriesData.length - 1].time;
    Chart.setData(seriesData);
    const carico = document.getElementById("chartLoading");
    if (carico) carico.hidden = true;
    paint();
  }

  function handleScrub(point) {
    scrub = point;
    paint();
  }

  /* ---------------- disegno ---------------- */

  function schedulePaint() {
    if (painting) return;
    painting = true;
    requestAnimationFrame(() => {
      painting = false;
      paint();
    });
  }

  function paint() {
    if (!state) return;
    const prices = Prices.all();
    const live = Equity.now(state, prices);

    // Il numero grande e il grafico seguono ogni singolo tick.
    renderHero(live);
    if (lastPointTime && Chart.ready && !scrub) Chart.updateLast(lastPointTime, live);

    // Le card costano di più da ridisegnare: bastano due volte al secondo,
    // altrimenti su telefono si scatterebbe inutilmente a ogni scambio.
    const adesso = Date.now();
    if (adesso - lastCardsPaint > 500) {
      lastCardsPaint = adesso;
      renderPositions(prices);
    }

    // Le operazioni cambiano solo quando il bot opera: si ridisegnano solo allora.
    const firma = (state.trades || []).length + "|" + ((state.trades || []).slice(-1)[0] || {}).time;
    if (firma !== tradesSignature) {
      tradesSignature = firma;
      renderTrades();
    }
  }

  function renderHero(live) {
    const value = scrub ? scrub.value : live;

    el.equity.innerHTML = `${Fmt.money(value)} <span style="font-size:.45em;color:var(--muted);font-weight:600">${CONFIG.quote}</span>`;

    if (scrub) {
      el.heroLabel.textContent = Fmt.dateTime(new Date(scrub.time * 1000));
      const diff = rangeFirstValue != null ? scrub.value - rangeFirstValue : 0;
      setDelta(el.deltaDay, diff, rangeFirstValue ? (diff / rangeFirstValue) * 100 : 0, "nel periodo");
      el.deltaTotal.hidden = true;
      return;
    }

    el.heroLabel.textContent = "Valore del portafoglio";
    el.deltaTotal.hidden = false;

    const snap = Equity.lastSnapshot(state);
    if (snap) {
      const diff = live - snap.equity;
      const when = new Date(snap.time);
      const sameDay = when.toDateString() === new Date().toDateString();
      setDelta(
        el.deltaDay,
        diff,
        (diff / snap.equity) * 100,
        sameDay ? `dalle ${Fmt.time(when)}` : `dal ${Fmt.dateTime(when)}`
      );
    }

    const total = live - state.start_equity;
    el.deltaTotal.textContent = `${Fmt.signed(total)} (${Fmt.pct((total / state.start_equity) * 100)}) da inizio`;
    el.deltaTotal.className = "delta muted";

    flash(live);
  }

  function setDelta(node, diff, pct, suffix) {
    node.textContent = `${Fmt.signed(diff)} (${Fmt.pct(pct)}) ${suffix}`;
    node.className = "delta " + (diff >= 0 ? "up" : "down");
  }

  // Lampeggio verde/rosso a ogni movimento del prezzo.
  function flash(live) {
    if (previous != null && Math.abs(live - previous) > 0.004) {
      el.equity.classList.remove("up", "down");
      void el.equity.offsetWidth; // riavvia la transizione
      el.equity.classList.add(live > previous ? "up" : "down");
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => el.equity.classList.remove("up", "down"), 700);
    }
    previous = live;
  }

  function renderPositions(prices) {
    const rows = Equity.positions(state, prices);
    const cash = `
      <div class="cash">
        <span>Liquidità non investita</span>
        <b>${Fmt.money(state.cash)} ${CONFIG.quote}</b>
      </div>`;

    if (!rows.length) {
      el.positions.innerHTML =
        `<p class="empty">Nessuna posizione aperta: il bot è tutto liquido.</p>` + cash;
      return;
    }

    el.positions.innerHTML =
      rows
        .map((p) => {
          const base = Sym.base(p.symbol);
          const cls = base === "BTC" ? "btc" : base === "ETH" ? "eth" : "other";
          return `
        <div class="pos">
          <div class="pos-icon ${cls}">${esc(base)}</div>
          <div class="pos-main">
            <div class="pos-name">${esc(nameOf(p.symbol))}</div>
            <div class="pos-sub">${Fmt.qty(p.qty)} · carico ${Fmt.price(p.entry)}</div>
          </div>
          <div class="pos-right">
            <div class="pos-value">${Fmt.money(p.value)}</div>
            <div class="pos-pl ${p.pl >= 0 ? "up" : "down"}">${Fmt.signed(p.pl)} (${Fmt.pct(p.plPct)})</div>
          </div>
        </div>`;
        })
        .join("") + cash;
  }

  function renderTrades() {
    const trades = (state.trades || []).slice().reverse().slice(0, 8);
    if (!trades.length) {
      el.trades.innerHTML = `<p class="empty">Il bot non ha ancora operato.</p>`;
      return;
    }

    el.trades.innerHTML = trades
      .map((t) => {
        const buy = t.side === "BUY";
        return `
        <div class="trade">
          <div class="trade-side ${buy ? "buy" : "sell"}">${buy ? "↓" : "↑"}</div>
          <div class="trade-main">
            <div class="trade-title">${buy ? "Comprato" : "Venduto"} ${esc(Sym.base(t.symbol))}</div>
            <div class="trade-sub">${Fmt.dateTime(new Date(t.time))} · ${Fmt.qty(t.qty)} a ${Fmt.price(t.price)}</div>
          </div>
          <div class="trade-val">${Fmt.money(t.value)}</div>
        </div>`;
      })
      .join("");
  }

  function renderStatus() {
    const status = Prices.status;
    const dot = status === "live" ? "live" : status === "connecting" ? "warn" : "off";
    el.statusDot.className = "status-dot " + dot;

    const at = GitHub.lastFetch;
    const stateAge = at ? `stato del bot letto alle ${Fmt.time(at)}` : "stato non ancora letto";
    const priceInfo =
      status === "live"
        ? `prezzi in diretta da ${Prices.source}`
        : status === "connecting"
        ? "collegamento ai prezzi…"
        : "prezzi non aggiornati";

    el.statusText.textContent = `${priceInfo} · ${stateAge}`;

    el.setSource.textContent = status === "live" ? Prices.source : "non collegato";
    const snap = state ? Equity.lastSnapshot(state) : null;
    el.setUpdated.textContent = snap
      ? `${Fmt.dateTime(new Date(snap.time))} · ${Fmt.money(snap.equity)} ${CONFIG.quote}`
      : "—";
  }

  /* ---------------- pulsanti ---------------- */

  function wireButtons() {
    el.ranges.addEventListener("click", (e) => {
      const btn = e.target.closest(".range");
      if (!btn) return;
      range = btn.dataset.range;
      el.ranges.querySelectorAll(".range").forEach((b) => b.classList.toggle("is-active", b === btn));
      loadSeries();
    });

    document.getElementById("settingsBtn").addEventListener("click", () => {
      renderStatus();
      el.settings.hidden = false;
    });
    document.getElementById("closeSettings").addEventListener("click", () => (el.settings.hidden = true));
    el.settings.addEventListener("click", (e) => {
      if (e.target === el.settings) el.settings.hidden = true;
    });

    document.getElementById("reloadBtn").addEventListener("click", async () => {
      el.settings.hidden = true;
      await refreshState();
      loadSeries();
    });

    document.getElementById("forgetBtn").addEventListener("click", () => {
      if (confirm("Cancello la chiave da questo dispositivo? Per rientrare dovrai incollarla di nuovo.")) {
        Gate.forget();
      }
    });
  }

  return {
    start,
    // Sportello per l'ispezione dalla console (utile in fase di prova).
    get debug() {
      return { state, seriesData, range, lastPointTime };
    },
  };
})();

Gate.init(App.start);

// Service worker: fa aprire l'app all'istante anche con rete lenta.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
