/* ============================================================
   La porta d'ingresso: finché su questo dispositivo non c'è una
   chiave valida, l'app non mostra nessun numero.

   La chiave la genera e la incolla l'utente. Vive solo nel
   localStorage di questo browser: non finisce in nessun file,
   non viene mai messa nell'indirizzo e non entra nella cache
   del service worker.
   ============================================================ */

const Gate = (() => {
  const gate = document.getElementById("gate");
  const app = document.getElementById("app");
  const form = document.getElementById("gateForm");
  const input = document.getElementById("tokenInput");
  const btn = document.getElementById("gateBtn");
  const errBox = document.getElementById("gateError");
  const demoBtn = document.getElementById("demoBtn");

  let onReady = () => {};

  function read() {
    try {
      return localStorage.getItem(CONFIG.storage.token) || "";
    } catch (e) {
      return ""; // navigazione privata con storage bloccato
    }
  }

  function write(token) {
    try {
      localStorage.setItem(CONFIG.storage.token, token);
    } catch (e) {
      /* se lo storage è bloccato la chiave vale solo per questa sessione */
    }
  }

  function forget() {
    try {
      localStorage.removeItem(CONFIG.storage.token);
    } catch (e) {}
    location.reload();
  }

  function showError(message) {
    errBox.textContent = message;
    errBox.hidden = false;
  }

  function open(message) {
    gate.hidden = false;
    app.hidden = true;
    if (message) showError(message);
  }

  function enter(token) {
    gate.hidden = true;
    app.hidden = false;
    errBox.hidden = true;
    onReady(token);
  }

  async function submit(event) {
    event.preventDefault();
    const token = input.value.trim();
    if (!token) return;

    btn.disabled = true;
    btn.textContent = "Controllo…";
    errBox.hidden = true;

    try {
      await GitHub.check(token);
      write(token);
      input.value = "";
      enter(token);
    } catch (err) {
      showError(
        err instanceof AuthError
          ? err.message
          : "Non riesco a contattare GitHub. Controlla la connessione e riprova."
      );
    } finally {
      btn.disabled = false;
      btn.textContent = "Entra";
    }
  }

  function init(callback) {
    onReady = callback;
    form.addEventListener("submit", submit);
    // La demo non salva niente: chiudendo la pagina si torna qui.
    demoBtn.addEventListener("click", () => enter(Demo.TOKEN));

    const saved = read();
    if (saved) enter(saved);
    else open();
  }

  // Chiamata dall'app se la chiave salvata smette di funzionare (scaduta o revocata).
  function reject(message) {
    try {
      localStorage.removeItem(CONFIG.storage.token);
    } catch (e) {}
    open(message);
  }

  return { init, forget, reject };
})();
