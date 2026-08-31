// Minimal hash-based router for switching between full-screen sections.
const Router = (() => {
  const routes = new Map(); // name -> { onEnter, onExit }
  let currentScreen = null;
  let defaultScreen = "intro";

  function register(name, { onEnter, onExit } = {}) {
    routes.set(name, { onEnter, onExit });
  }

  function setDefault(name) {
    defaultScreen = name;
  }

  function parseHash() {
    const hash = window.location.hash.replace(/^#\/?/, "");
    return hash || defaultScreen;
  }

  function navigate(name) {
    if (!routes.has(name)) {
      console.warn(`Router: unknown screen "${name}", falling back to "${defaultScreen}"`);
      name = defaultScreen;
    }
    if (window.location.hash.replace(/^#\/?/, "") !== name) {
      window.location.hash = `#${name}`;
      return; // hashchange will trigger the actual switch
    }
    switchTo(name);
  }

  function switchTo(name) {
    if (currentScreen === name) return;

    if (currentScreen && routes.has(currentScreen)) {
      const el = document.querySelector(`[data-screen="${currentScreen}"]`);
      if (el) el.hidden = true;
      routes.get(currentScreen).onExit?.();
    }

    currentScreen = name;

    const nextEl = document.querySelector(`[data-screen="${name}"]`);
    if (nextEl) nextEl.hidden = false;
    routes.get(name)?.onEnter?.();

    document.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.nav === name);
    });
  }

  function handleHashChange() {
    switchTo(parseHash());
  }

  function init() {
    window.addEventListener("hashchange", handleHashChange);

    document.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => navigate(btn.dataset.nav));
    });

    switchTo(parseHash());
  }

  return { register, setDefault, navigate, init };
})();
