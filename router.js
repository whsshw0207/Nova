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
      routes.get(currentScreen).onExit?.();
    }

    currentScreen = name;

    // 추적 변수(currentScreen)가 실제 DOM 상태와 어긋나 있을 수 있으므로
    // (예: 초기 로드시 해시가 기본 화면이 아닌 경우) 매번 전체를 먼저 숨긴다.
    document.querySelectorAll("[data-screen]").forEach((el) => {
      el.style.display = "none";
    });

    const nextEl = document.querySelector(`[data-screen="${name}"]`);
    if (nextEl) nextEl.style.removeProperty("display");
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
