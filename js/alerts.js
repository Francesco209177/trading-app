/* ============================================================
   Avviso quando il bot opera. Mentre hai l'app aperta (o alla
   prima apertura dopo che è successo), un banner in cima segnala
   le operazioni nuove rispetto all'ultima volta che le hai viste.

   "Viste" è salvato per dispositivo in localStorage: alla primissima
   apertura in assoluto non mostra nulla (non è una novità, è solo
   lo stato attuale) — solo dalle volte successive segnala il nuovo.
   ============================================================ */

const Alerts = (() => {
  const KEY = "portafoglio-bot.lastSeenTrade";
  const box = document.getElementById("banners");

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      return null;
    }
  }

  function write(trade) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ time: trade.time }));
    } catch (e) {}
  }

  function show(nuove) {
    const eur = Currency.eur;
    const testo =
      nuove.length === 1
        ? `Il bot ha ${nuove[0].side === "BUY" ? "comprato" : "venduto"} ${Sym.base(nuove[0].symbol)} a ${Fmt.price(eur(nuove[0].price))} ${CONFIG.display}`
        : `Il bot ha fatto ${nuove.length} operazioni nuove`;

    const el = document.createElement("div");
    el.className = "banner banner-trade";
    el.innerHTML = `<span class="dot"></span><span>${testo}</span><button class="banner-close" aria-label="Chiudi">×</button>`;
    el.querySelector(".banner-close").addEventListener("click", () => el.remove());
    box.prepend(el);
  }

  // Chiamata a ogni aggiornamento dello stato: fa quasi sempre nulla,
  // il confronto tra due orari costa niente.
  function checkNewTrade(state) {
    const trades = state.trades || [];
    if (!trades.length) return;
    const latest = trades[trades.length - 1];

    const seen = read();
    if (!seen) {
      write(latest); // prima apertura su questo dispositivo: si registra e basta
      return;
    }

    if (new Date(latest.time) <= new Date(seen.time)) return; // niente di nuovo

    const nuove = trades.filter((t) => new Date(t.time) > new Date(seen.time));
    show(nuove);
    write(latest);
  }

  return { checkNewTrade };
})();
