/* ============================================================
   Storico completo: tutte le operazioni del bot, non solo le
   ultime 8 che si vedono in Home, con un filtro per moneta.
   ============================================================ */

const History = (() => {
  const el = {
    filter: document.getElementById("historyFilter"),
    list: document.getElementById("historyList"),
  };
  const eur = Currency.eur;
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

  let filter = "TUTTE";

  function render() {
    const state = App.getState();
    if (!state) {
      el.list.innerHTML = `<p class="empty">Ancora nessun dato dal bot.</p>`;
      return;
    }

    const trades = (state.trades || [])
      .filter((t) => filter === "TUTTE" || Sym.base(t.symbol) === filter)
      .slice()
      .reverse();

    if (!trades.length) {
      el.list.innerHTML = `<p class="empty">Nessuna operazione${filter === "TUTTE" ? "" : " su " + filter}.</p>`;
      return;
    }

    el.list.innerHTML = trades
      .map((t) => {
        const buy = t.side === "BUY";
        return `
        <div class="trade">
          <div class="trade-side ${buy ? "buy" : "sell"}" title="${buy ? "Acquisto" : "Vendita"}">${buy ? "A" : "V"}</div>
          <div class="trade-main">
            <div class="trade-title">${buy ? "Comprato" : "Venduto"} ${esc(Sym.base(t.symbol))}</div>
            <div class="trade-sub">${Fmt.dateTime(new Date(t.time))} · ${Fmt.qty(t.qty)} a ${Fmt.price(eur(t.price))}&nbsp;${CONFIG.display}</div>
          </div>
          <div class="trade-val">${Fmt.cur(eur(t.value))}</div>
        </div>`;
      })
      .join("");
  }

  function wire() {
    if (el.filter.dataset.wired) return;
    el.filter.dataset.wired = "1";
    el.filter.addEventListener("click", (e) => {
      const btn = e.target.closest(".range");
      if (!btn) return;
      filter = btn.dataset.filter;
      el.filter.querySelectorAll(".range").forEach((b) => b.classList.toggle("is-active", b === btn));
      render();
    });
  }

  function enter() {
    wire();
    render();
  }

  Router.register("history", "view-history", enter);
})();
