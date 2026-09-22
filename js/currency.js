/* ============================================================
   Conversione USDT → euro, usata da ogni pagina che mostra soldi
   (Home, Storico, Statistiche, Confronto).

   Il bot ragiona in USDT; a schermo mostriamo sempre euro, al cambio
   del momento (Prices.eurRate, aggiornato in prices.js). Le percentuali
   non passano mai di qui: il cambio si semplifica tra numeratore e
   denominatore, quindi restano identiche in entrambe le valute.
   ============================================================ */

const Currency = {
  eur: (usdt) => usdt * Prices.eurRate,
};
