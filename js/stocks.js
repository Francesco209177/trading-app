/* ============================================================
   Pagina "Azioni": il laboratorio azionario (dal 16/11/2026).

   Un secondo bot, solo simulazione, su S&P 500 (SPY), Nasdaq 100 (QQQ)
   e Italia (EWI). Dal 17/11/2026 ha due motori, ognuno con 1.000 $ finti:
   "Cali" (compra i cali forti) e "Trend" (investito sopra la media a 200
   giorni). Qui si vede il totale, con il dettaglio per motore.

   I prezzi delle azioni non si possono leggere da qui (Yahoo blocca le
   richieste dai siti), quindi e' il bot a pubblicare a ogni giro un
   riepilogo gia' calcolato: lab_view.json nel ramo "dati".

   Gli euro usano il cambio letto dal bot in quel giro, lo stesso dei
   messaggi Telegram ed email: cosi' i numeri combaciano dappertutto.
   ============================================================ */

const Stocks = (() => {
  const el = { box: document.getElementById("stocksContent") };
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

  let view = null;
  let timer = null;
  let error = null;

  async function load() {
    try {
      const res = await fetch(`${CONFIG.labView}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`GitHub ha risposto ${res.status}`);
      view = await res.json();
      error = null;
    } catch (e) {
      error = e.message;
    }
    render();
  }

  // Euro con il cambio del bot; se manca, quello del sito.
  const eur = (usd) => (view && view.usd_eur ? usd * view.usd_eur : Currency.eur(usd));
  const usd = (n, signed) => (signed ? Fmt.signed(n) : Fmt.money(n)) + "&nbsp;$";
  const cls = (n) => (Math.round(Math.abs(n) * 100) === 0 ? "" : n >= 0 ? "up" : "down");
  const plural = (n) => `${n} posizion${n === 1 ? "e" : "i"}`;

  function tile(label, euro, dollars, kind) {
    return `<div class="stat-tile">
      <div class="label">${label}</div>
      <div class="value ${kind || ""}">${euro}</div>
      <div class="tile-sub">${dollars}</div>
    </div>`;
  }

  function render() {
    if (!el.box) return;
    if (!view) {
      el.box.innerHTML = `<p class="empty">${error ? `Dati non disponibili (${esc(error)}). Riprovo tra poco.` : "Carico i dati del laboratorio…"}</p>`;
      return;
    }
    const v = view;
    const updated = new Date(v.updated);
    const rate = v.usd_eur ? `1 $ = ${Fmt.money(v.usd_eur, 4)} €` : "cambio del sito";
    // Il riepilogo vecchio (un solo motore) non ha "motors": la pagina resta leggibile.
    const motors = v.motors || [];

    const tiles = [
      tile("Fondo di partenza (soldi finti)", Fmt.cur(eur(v.start)), usd(v.start)),
      // Con due motori le posizioni si contano per mercato (uno stesso mercato può averlo comprato più di un motore).
      tile("Investito adesso", Fmt.cur(eur(v.invested)), `${usd(v.invested)} · ${!v.n_pos ? "nessuna posizione" : motors.length > 1 ? `su ${v.n_pos} mercat${v.n_pos === 1 ? "o" : "i"}` : plural(v.n_pos)}`),
      tile("Liquidità", Fmt.cur(eur(v.cash)), usd(v.cash)),
      tile("Guadagno dall'inizio", `${Fmt.signedCur(eur(v.pnl))}`, `${usd(v.pnl, true)} · ${Fmt.pct(v.pnl_pct)}`, cls(v.pnl)),
    ].join("");

    const motorsBlock =
      motors.length > 1
        ? `<section class="block"><h2>I due motori</h2><div class="summary-card">${motors
            .map(
              (m) => `<div class="summary-row">
                <b>${esc(m.label)}</b> · ${Fmt.cur(eur(m.equity))}
                <span class="${cls(m.pnl)}">${Fmt.signedCur(eur(m.pnl))} (${Fmt.pct(m.pnl_pct)})</span>
                <div class="tile-sub">${esc(m.strategy)} · ${m.n_pos ? plural(m.n_pos) : "nessuna posizione"}</div>
              </div>`
            )
            .join("")}</div></section>`
        : "";

    const held = v.markets.filter((m) => m.position);
    const positions = held.length
      ? held
          .map((m) => {
            const p = m.position;
            const who = (m.motors || []).filter((x) => x.in_position).map((x) => x.label).filter(Boolean);
            return `<div class="pos">
              <div class="pos-icon other">${esc(m.symbol.split("/")[0])}</div>
              <div class="pos-main">
                <div class="pos-name">${esc(m.name)}${who.length ? ` <span class="chip">${esc(who.join(" + "))}</span>` : ""}</div>
                <div class="pos-sub">${Fmt.qty(p.qty)} quote · carico ${Fmt.price(eur(p.entry_price))}&nbsp;€ · ora ${Fmt.price(eur(m.price))}&nbsp;€</div>
              </div>
              <div class="pos-right">
                <div class="pos-value">${Fmt.cur(eur(p.value))}</div>
                <div class="pos-pl ${cls(p.pnl)}">${Fmt.signedCur(eur(p.pnl))} (${Fmt.pct(p.pnl_pct)})</div>
              </div>
            </div>`;
          })
          .join("")
      : `<p class="empty">Nessuna posizione aperta: i motori aspettano il loro segnale.</p>`;

    const markets =
      v.markets
        .map((m) => {
          const lines = (m.motors && m.motors.length ? m.motors : [{ label: "", reason: m.reason }])
            .map((x) => `<div class="tile-sub">${x.label ? `<b>${esc(x.label)}</b>: ` : ""}${esc(x.reason)}</div>`)
            .join("");
          return `<div class="summary-row"><b>${esc(m.name)}</b> · ${Fmt.price(eur(m.price))}&nbsp;€${lines}</div>`;
        })
        .join("") + `<div class="tile-sub"><i>Nelle spiegazioni i prezzi sono in dollari.</i></div>`;

    const trades = (v.trades || [])
      .slice()
      .reverse()
      .slice(0, 12)
      .map((t) => {
        const buy = t.side === "BUY";
        const name = (v.markets.find((m) => m.symbol === t.symbol) || {}).name || t.symbol;
        return `<div class="trade">
          <div class="trade-side ${buy ? "buy" : "sell"}">${buy ? "A" : "V"}</div>
          <div class="trade-main">
            <div class="trade-title">${buy ? "Comprato" : "Venduto"} ${esc(name)}${t.motor ? ` <span class="chip">${esc(t.motor)}</span>` : ""}</div>
            <div class="trade-sub">${Fmt.dateTime(new Date(t.time))} · ${Fmt.qty(t.qty)} a ${Fmt.price(eur(t.price))}&nbsp;€</div>
          </div>
          <div class="trade-val">${Fmt.cur(eur(t.value))}</div>
        </div>`;
      })
      .join("");

    el.box.innerHTML = `
      <section class="hero">
        <div class="hero-label">Valore del laboratorio</div>
        <div class="equity">${Fmt.money(eur(v.equity))} <span style="font-size:.45em;color:var(--muted);font-weight:600">€</span></div>
        <div class="deltas">
          <span class="delta ${cls(v.pnl)}">${Fmt.signedCur(eur(v.pnl))} (${Fmt.pct(v.pnl_pct)}) da inizio</span>
          <span class="delta muted">${usd(v.equity)} · ${rate}</span>
        </div>
        ${Thermo.html(v.drawdown_pct, v.expected_max_drawdown_pct)}
      </section>
      <div class="stat-grid">${tiles}</div>
      ${motorsBlock}
      <section class="block"><h2>Posizioni</h2>${positions}</section>
      <section class="block"><h2>Segnale di oggi</h2><div class="summary-card">${markets}</div></section>
      <section class="block"><h2>Operazioni</h2><div class="trades">${trades || `<p class="empty">Ancora nessuna operazione.</p>`}</div></section>
      <p class="stat-note">
        ${motors.length > 1 ? "Due motori, 1.000 $ finti ciascuno." : esc(v.strategy || "") + "."} Solo simulazione.
        Opera una volta per seduta della borsa di New York (aperta ${v.market_open ? "adesso" : "dalle 15:30 alle 22:00 italiane, lun–ven"}).
        Dati del ${Fmt.dateTime(updated)}: il bot si aggiorna circa ogni 6 ore.
      </p>`;
  }

  function enter() {
    load();
    clearInterval(timer);
    timer = setInterval(load, 5 * 60 * 1000); // il file cambia al massimo a ogni giro del bot
  }

  function leave() {
    clearInterval(timer);
    timer = null;
  }

  Router.register("stocks", "view-stocks", enter, leave);
})();
