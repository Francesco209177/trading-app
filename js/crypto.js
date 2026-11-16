/* ============================================================
   Pagina "Crypto": il bot principale (Bitcoin, Ethereum, oro) con la
   stessa impostazione della pagina "Azioni": fondo di partenza in soldi
   finti, investito adesso, liquidita' e guadagno, tutto in euro.

   A differenza delle azioni qui i prezzi sono in diretta (Binance/Kraken)
   e lo stato del bot e' quello gia' letto dall'app: nessun dato in piu'.
   Solo lettura: non cambia niente del bot ne' della sua strategia.
   ============================================================ */

const CryptoView = (() => {
  const el = { box: document.getElementById("cryptoContent") };
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const NOMI = { BTC: "Bitcoin", ETH: "Ethereum", PAXG: "Oro (PAXG)" };
  const nome = (pair) => NOMI[Sym.base(pair)] || Sym.base(pair);
  const eur = Currency.eur;
  const usdt = (n, signed) => (signed ? Fmt.signed(n) : Fmt.money(n)) + "&nbsp;" + CONFIG.quote;
  const cls = (n) => (Math.round(Math.abs(n) * 100) === 0 ? "" : n >= 0 ? "up" : "down");

  let timer = null;

  function tile(label, euro, sub, kind) {
    return `<div class="stat-tile">
      <div class="label">${label}</div>
      <div class="value ${kind || ""}">${euro}</div>
      <div class="tile-sub">${sub}</div>
    </div>`;
  }

  function render() {
    const state = App.getState();
    if (!el.box) return;
    if (!state) {
      el.box.innerHTML = `<p class="empty">Carico i dati del bot…</p>`;
      return;
    }
    const prices = Prices.all();
    const equity = Equity.now(state, prices);
    const rows = Equity.positions(state, prices);
    const invested = rows.reduce((s, p) => s + p.value, 0);
    const cash = Equity.freeCash(state, prices);
    const start = state.start_equity;
    const pnl = equity - start;
    const pnlPct = (pnl / start) * 100;

    const tiles = [
      tile("Fondo di partenza (soldi finti)", Fmt.cur(eur(start)), usdt(start)),
      tile("Investito adesso", Fmt.cur(eur(invested)), `${usdt(invested)} · ${rows.length} posizion${rows.length === 1 ? "e" : "i"}`),
      tile("Liquidità", Fmt.cur(eur(cash)), usdt(cash)),
      tile("Guadagno dall'inizio", Fmt.signedCur(eur(pnl)), `${usdt(pnl, true)} · ${Fmt.pct(pnlPct)}`, cls(pnl)),
    ].join("");

    const positions = rows.length
      ? rows
          .map((p) => `<div class="pos">
              <div class="pos-icon ${Sym.base(p.symbol) === "BTC" ? "btc" : Sym.base(p.symbol) === "ETH" ? "eth" : "gold"}">${esc(Sym.base(p.symbol) === "PAXG" ? "Au" : Sym.base(p.symbol))}</div>
              <div class="pos-main">
                <div class="pos-name">${esc(nome(p.symbol))}${p.short ? ` <span class="chip">allo scoperto</span>` : ""}</div>
                <div class="pos-sub">${Fmt.qty(p.qty)} · ${p.short ? "venduto a" : "carico"} ${Fmt.price(eur(p.entry))}&nbsp;€ · ora ${Fmt.price(eur(p.price))}&nbsp;€</div>
              </div>
              <div class="pos-right">
                <div class="pos-value">${Fmt.cur(eur(p.value))}</div>
                <div class="pos-pl ${cls(p.pl)}">${Fmt.signedCur(eur(p.pl))} (${Fmt.pct(p.plPct)})</div>
              </div>
            </div>`)
          .join("")
      : `<p class="empty">Nessuna posizione aperta: il bot è tutto liquido.</p>`;

    const markets = (CONFIG.pairs || [])
      .map((pair) => {
        const it = Signal.intent(pair, (state.positions || {})[pair], (state.stopped || {})[pair]);
        const price = prices[pair];
        return `<div class="summary-row">
          <b>${esc(nome(pair))}</b>${price != null ? ` · ${Fmt.price(eur(price))}&nbsp;€` : ""}
          ${it ? `<span class="chip ${it.cls}">${esc(it.text)}</span>` : `<span class="tile-sub">segnale in arrivo…</span>`}
        </div>`;
      })
      .join("");

    const trades = (state.trades || [])
      .slice()
      .reverse()
      .slice(0, 10)
      .map((t) => `<div class="trade">
          <div class="trade-side ${t.side === "BUY" ? "buy" : "sell"}" title="${Side.title(t)}">${Side.letter(t)}</div>
          <div class="trade-main">
            <div class="trade-title">${Side.label(t)} ${esc(nome(t.symbol))}</div>
            <div class="trade-sub">${Fmt.dateTime(new Date(t.time))} · ${Fmt.qty(t.qty)} a ${Fmt.price(eur(t.price))}&nbsp;€</div>
          </div>
          <div class="trade-val">${Fmt.cur(eur(t.value))}</div>
        </div>`)
      .join("");

    el.box.innerHTML = `
      <section class="hero">
        <div class="hero-label">Valore del bot principale</div>
        <div class="equity">${Fmt.money(eur(equity))} <span style="font-size:.45em;color:var(--muted);font-weight:600">€</span></div>
        <div class="deltas">
          <span class="delta ${cls(pnl)}">${Fmt.signedCur(eur(pnl))} (${Fmt.pct(pnlPct)}) da inizio</span>
          <span class="delta muted">${usdt(equity)} · 1 ${CONFIG.quote} = ${Fmt.money(Prices.eurRate, 4)} €</span>
        </div>
      </section>
      <div class="stat-grid">${tiles}</div>
      <section class="block"><h2>Posizioni</h2>${positions}</section>
      <section class="block"><h2>Segnale di oggi</h2><div class="summary-card">${markets}</div></section>
      <section class="block"><h2>Operazioni</h2><div class="trades">${trades || `<p class="empty">Ancora nessuna operazione.</p>`}</div></section>
      <p class="stat-note">
        Solo simulazione, soldi finti. Prezzi in diretta; lo stato del bot (posizioni, liquidità) si aggiorna a ogni
        suo giro, circa ogni 6 ore. Con lo scoperto si guadagna quando il prezzo scende.
      </p>`;
  }

  function enter() {
    if (!Signal.ready) Signal.refresh(CONFIG.pairs || []).then(render);
    render();
    clearInterval(timer);
    timer = setInterval(render, 2000); // prezzi in diretta: due ridisegni al secondo non servono
  }

  function leave() {
    clearInterval(timer);
    timer = null;
  }

  Router.register("crypto", "view-crypto", enter, leave);
})();
