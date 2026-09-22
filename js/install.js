/* ============================================================
   Invito a installare l'app, in un tocco.

   Chrome su Android tiene pronto l'evento "beforeinstallprompt"
   invece di mostrare da solo un suo banner: lo intercettiamo e ci
   costruiamo sopra un pulsante nostro, coerente col resto dell'app.
   Se il browser non lo supporta (es. iPhone), semplicemente non
   succede nulla — restano valide le istruzioni nel README.
   ============================================================ */

const InstallPrompt = (() => {
  const box = document.getElementById("banners");
  let deferred = null;

  function alreadyInstalled() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function show() {
    if (alreadyInstalled() || document.getElementById("installBanner")) return;

    const el = document.createElement("div");
    el.id = "installBanner";
    el.className = "banner banner-install";
    el.innerHTML = `
      <span>Installa l'app sulla schermata Home</span>
      <button class="banner-action">Installa</button>
      <button class="banner-close" aria-label="Chiudi">×</button>`;

    el.querySelector(".banner-action").addEventListener("click", async () => {
      if (!deferred) return;
      el.remove();
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch (e) {}
      deferred = null;
    });
    el.querySelector(".banner-close").addEventListener("click", () => el.remove());

    box.prepend(el);
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // niente banner di sistema: usiamo il nostro
    deferred = e;
    show();
  });

  window.addEventListener("appinstalled", () => {
    const el = document.getElementById("installBanner");
    if (el) el.remove();
    deferred = null;
  });
})();
