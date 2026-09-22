/* ============================================================
   Il router: cambia quale pagina si vede, senza mai ricaricare.

   Ogni pagina si registra con il proprio contenitore e una funzione
   onEnter, chiamata la prima volta che si apre quella pagina (per
   disegnarla) e ogni volta successiva (per aggiornarla). Le pagine
   non ancora aperte non fanno nessun lavoro: zero costo finché non
   servono davvero.
   ============================================================ */

const Router = (() => {
  const views = {};
  let active = null;

  function register(name, sectionId, onEnter, onLeave) {
    views[name] = {
      section: document.getElementById(sectionId),
      onEnter: onEnter || (() => {}),
      onLeave: onLeave || (() => {}),
      entered: false,
    };
  }

  function go(name) {
    if (!views[name] || name === active) return;

    if (active && views[active]) views[active].onLeave();

    Object.entries(views).forEach(([key, v]) => {
      if (v.section) v.section.hidden = key !== name;
    });
    document.querySelectorAll(".navbtn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.view === name);
    });

    active = name;
    const view = views[name];
    view.onEnter(view.entered);
    view.entered = true;
  }

  function init(defaultView) {
    document.querySelectorAll(".navbtn[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => go(btn.dataset.view));
    });
    // Link interni tipo "Vedi tutte le operazioni →" dentro le pagine.
    document.addEventListener("click", (e) => {
      const link = e.target.closest("[data-nav]");
      if (!link) return;
      e.preventDefault();
      go(link.dataset.nav);
    });
    go(defaultView);
  }

  return { register, go, init };
})();
