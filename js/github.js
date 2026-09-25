/* ============================================================
   Lettura dello stato del bot dal repo PRIVATO su GitHub.

   Il file state/portfolio.json viene aggiornato dal bot nel cloud
   (al massimo una volta ogni ora). Lo rileggiamo ogni minuto usando
   l'ETag: se non è cambiato GitHub risponde 304, che non consuma
   il limite di richieste (5.000/ora, a noi ne bastano 60).

   Lo stato resta SOLO in memoria: non viene salvato sul dispositivo.
   ============================================================ */

class AuthError extends Error {}

const GitHub = (() => {
  const URL_STATE = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.path}`;

  let etag = null;
  let last = null;
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
    if (Demo.is(token)) return true;
    const res = await fetch(URL_STATE, { headers: headers(token), cache: "no-store" });
    if (!res.ok) throw explain(res.status);
    return true;
  }

  // Scarica lo stato. changed=false significa "identico a prima" (304).
  async function load(token) {
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
    check,
    load,
    get lastFetch() {
      return lastFetch;
    },
  };
})();
