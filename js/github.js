/* ============================================================
   Lettura dello stato del bot.

   Di norma (dal 27/10/2026) dalla copia PUBBLICA che il bot pubblica
   ogni ora nel ramo "dati" del repo del sito: nessuna chiave.
   In alternativa, con una chiave, dal repo PRIVATO su GitHub.

   Il file state/portfolio.json viene aggiornato dal bot nel cloud
   (al massimo una volta ogni ora). Lo rileggiamo ogni minuto usando
   l'ETag: se non è cambiato GitHub risponde 304, che non consuma
   il limite di richieste (5.000/ora, a noi ne bastano 60).

   Lo stato resta SOLO in memoria: non viene salvato sul dispositivo.
   ============================================================ */

class AuthError extends Error {}

const GitHub = (() => {
  const URL_STATE = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.path}`;

  // "Chiave" finta che dice all'app di usare i dati pubblici.
  const PUBLIC = "__pubblico__";
  const isPublic = (token) => token === PUBLIC;

  let etag = null;
  let last = null;
  let lastText = null;
  let lastFetch = null;

  function headers(token, extra) {
    return Object.assign(
      {
        Accept: "application/vnd.github.raw",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      extra || {}
    );
  }

  // Traduce i codici di errore di GitHub in italiano comprensibile.
  function explain(status) {
    if (status === 401)
      return new AuthError("Chiave rifiutata da GitHub: è sbagliata, scaduta o è stata revocata.");
    if (status === 403)
      return new AuthError(
        `Accesso negato. Controlla che la chiave abbia il permesso "Contents: Read-only" sul repo ${CONFIG.repo}.`
      );
    if (status === 404)
      return new AuthError(
        `Non trovo ${CONFIG.owner}/${CONFIG.repo}/${CONFIG.path}. La chiave non ha accesso a questo repo, oppure il file non c'è.`
      );
    return new Error(`GitHub ha risposto ${status}.`);
  }

  // Usata dalla schermata della chiave: una richiesta di prova.
  async function check(token) {
    if (Demo.is(token) || isPublic(token)) return true;
    const res = await fetch(URL_STATE, { headers: headers(token), cache: "no-store" });
    if (!res.ok) throw explain(res.status);
    return true;
  }

  // Dati pubblici: nessuna chiave, nessun limite di richieste. Il file si
  // confronta col precedente per sapere se è cambiato.
  async function loadPublic() {
    const res = await fetch(`${CONFIG.publicState}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GitHub ha risposto ${res.status}.`);
    const text = await res.text();
    const changed = text !== lastText;
    if (changed) {
      last = JSON.parse(text);
      lastText = text;
    }
    lastFetch = new Date();
    return { changed, state: last, at: lastFetch };
  }

  // Scarica lo stato. changed=false significa "identico a prima" (304).
  async function load(token) {
    if (isPublic(token)) return loadPublic();

    // Modalità demo: dati inventati, nessuna richiesta a GitHub.
    if (Demo.is(token)) {
      const res = await Demo.load();
      lastFetch = res.at;
      return res;
    }

    const res = await fetch(URL_STATE, {
      headers: headers(token, etag ? { "If-None-Match": etag } : null),
      cache: "no-store",
    });

    if (res.status === 304) {
      lastFetch = new Date();
      return { changed: false, state: last, at: lastFetch };
    }
    if (!res.ok) throw explain(res.status);

    etag = res.headers.get("ETag");
    last = JSON.parse(await res.text());
    lastFetch = new Date();
    return { changed: true, state: last, at: lastFetch };
  }

  return {
    PUBLIC,
    isPublic,
    check,
    load,
    get lastFetch() {
      return lastFetch;
    },
  };
})();
