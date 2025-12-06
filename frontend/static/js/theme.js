// static/js/theme.js
(() => {
  const KEY = "theme_pref"; // 'light' | 'dark' | 'auto'

  const resolve = (p) => {
    if (p === "light" || p === "dark") return p;
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  function apply(pref) {
    const applied = resolve(pref);
    document.documentElement.setAttribute("data-theme-pref", pref);
    document.documentElement.setAttribute("data-theme", applied);
    document.documentElement.setAttribute("data-bs-theme", applied); // để Bootstrap theo

    // clear listener cũ
    if (apply._media) {
      apply._media.removeEventListener("change", apply._onChange);
      apply._media = null;
    }
    if (pref === "auto" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => {
        const next = mq.matches ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        document.documentElement.setAttribute("data-bs-theme", next);
      };
      mq.addEventListener("change", onChange);
      apply._media = mq;
      apply._onChange = onChange;
    }
  }

  window.ThemeManager = {
    getPref() {
      return localStorage.getItem(KEY) || "auto";
    },
    setPref(pref) {
      localStorage.setItem(KEY, pref);
      apply(pref);
    },
    applyCurrent() {
      apply(this.getPref());
    },
  };
})();
