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

  // Hàm bổ sung: Khởi tạo trạng thái nút toggle
  function initThemeToggle() {
    const themePref = localStorage.getItem(KEY) || "auto";
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const isDark =
      themePref === "dark" || (themePref === "auto" && currentTheme === "dark");
    const toggle = document.getElementById("themeToggle");
    if (toggle) {
      toggle.checked = isDark;
    }
  }

  window.ThemeManager = {
    getPref() {
      return localStorage.getItem(KEY) || "auto";
    },
    setPref(pref) {
      localStorage.setItem(KEY, pref);
      apply(pref);
      initThemeToggle(); // Cập nhật trạng thái nút sau khi đặt
    },
    applyCurrent() {
      apply(this.getPref());
      initThemeToggle(); // Cập nhật trạng thái nút khi khởi động
    },
    toggleTheme() {
      // Lấy theme hiện tại đang được áp dụng
      const currentAppliedTheme =
        document.documentElement.getAttribute("data-theme");
      // Đặt theme mới ngược lại
      const nextTheme = currentAppliedTheme === "dark" ? "light" : "dark";
      // Lưu và áp dụng theme mới
      this.setPref(nextTheme);
    },
  };

  // Gọi initThemeToggle một lần sau khi ThemeManager được định nghĩa
  document.addEventListener("DOMContentLoaded", initThemeToggle);
})();
