/* frontend/static/js/auth.js
 * Xử lý: register, login, forgot, reset, Google Sign-In (nút custom)
 * Yêu cầu: backend có các endpoint /api/auth/*
 */

/* ---------- Config & Utils ---------- */
const CFG = (() => {
  // Cho phép đặt sẵn trong template: window.APP_CONFIG = { apiBase: "...", googleClientId: "..." }
  const g = (typeof window !== "undefined" && window.APP_CONFIG) || {};
  return {
    API_BASE: g.apiBase || "", // "" = same-origin
    GOOGLE_CLIENT_ID: g.googleClientId || "", // bắt buộc để dùng Google
  };
})();

function $(sel, root = document) {
  return root.querySelector(sel);
}
function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function showMsg(text, ok = false) {
  const el = $("#msg");
  if (el) {
    el.style.display = "block";
    el.className = "mt-3 alert " + (ok ? "alert-success" : "alert-danger");
    el.textContent = text;
  } else {
    // fallback
    ok ? console.info(text) : alert(text);
  }
}

async function api(path, method = "GET", body) {
  const url = (CFG.API_BASE || "") + "/api" + path;
  const opt = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opt.body = JSON.stringify(body);
  const resp = await fetch(url, opt);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.success === false) {
    const message = data.message || `Request failed (HTTP ${resp.status})`;
    const err = new Error(message);
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* ---------- Password toggle (nếu có nút) ---------- */
function bindPasswordToggle(inputId, btnId) {
  const ip = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!ip || !btn) return;
  btn.addEventListener("click", () => {
    ip.type = ip.type === "password" ? "text" : "password";
  });
}

/* ---------- Register ---------- */
function attachRegister() {
  const form = $("#registerForm");
  if (!form) return;

  const btn = $("#btnSubmit");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const payload = {
      full_name: fd.get("full_name"),
      email: fd.get("email"),
      password: fd.get("password"),
      confirm_password: fd.get("confirm_password"),
    };

    if ((payload.password || "") !== (payload.confirm_password || "")) {
      showMsg("Mật khẩu nhập lại không khớp");
      return;
    }

    if (btn) {
      btn.disabled = true;
      var oldText = btn.textContent;
      btn.textContent = "Đang tạo tài khoản...";
    }

    try {
      const data = await api("/auth/register", "POST", payload);
      showMsg("Đăng ký thành công! Đang chuyển...", true);
      setTimeout(() => (window.location.href = "/login"), 800);
    } catch (err) {
      console.error(err);
      showMsg(err.message || "Đăng ký thất bại");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  });

  // Toggles nếu tồn tại
  bindPasswordToggle("regPass", "toggleRegPass");
  bindPasswordToggle("regPass2", "toggleRegPass2");

  // Google button (giữ nút custom)
  const btnGoogle = $("#btnGoogle");
  if (btnGoogle) {
    setupGoogle(btnGoogle, async (credential) => {
      const data = await api("/auth/google", "POST", { credential });
      // lưu và chuyển trang
      localStorage.setItem("access_token", data.access_token || "");
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/dashboard";
    });
  }
}

/* ---------- Login ---------- */
function attachLogin() {
  const form = $("#loginForm");
  if (!form) return;

  const btn = $("#btnLogin");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const payload = {
      email: fd.get("email"),
      password: fd.get("password"),
      remember: $("#remember")?.checked || false,
    };

    if (btn) {
      btn.disabled = true;
      var oldText = btn.textContent;
      btn.textContent = "Đang đăng nhập...";
    }

    try {
      const data = await api("/auth/login", "POST", payload);
      localStorage.setItem("token_type", data.token_type || "Bearer");
      localStorage.setItem("access_token", data.access_token || "");
      localStorage.setItem("refresh_token", data.refresh_token || "");
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      showMsg("Đăng nhập thành công! Đang chuyển...", true);
      setTimeout(() => (window.location.href = "/dashboard"), 600);
    } catch (err) {
      console.error(err);
      showMsg(err.message || "Đăng nhập thất bại");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  });

  bindPasswordToggle("loginPass", "toggleLoginPass");

  // Google button (giữ nút custom)
  const btnGoogle = $("#btnGoogle");
  if (btnGoogle) {
    setupGoogle(btnGoogle, async (credential) => {
      const data = await api("/auth/google", "POST", { credential });
      localStorage.setItem("access_token", data.access_token || "");
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/dashboard";
    });
  }
}

/* ---------- Forgot ---------- */
function attachForgot() {
  const form = $("#forgotForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await api("/auth/forgot", "POST", Object.fromEntries(fd.entries()));
      showMsg("Link đặt lại mật khẩu đã được gửi đến email của bạn", true);
    } catch (err) {
      console.error(err);
      showMsg(err.message || "Gửi link thất bại");
    }
  });
}

/* ---------- Reset ---------- */
function attachReset() {
  const form = $("#resetForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if ((data.password || "") !== (data.confirm_password || "")) {
      showMsg("Mật khẩu không khớp");
      return;
    }
    try {
      await api("/auth/reset", "POST", data);
      showMsg("Đặt lại mật khẩu thành công! Vui lòng đăng nhập.", true);
      setTimeout(() => (window.location.href = "/login"), 800);
    } catch (err) {
      console.error(err);
      showMsg(err.message || "Đặt lại mật khẩu thất bại");
    }
  });
}

/* ---------- Google Sign-In (GIS) với nút custom) ---------- */
let _gisReady = false;
let _gisInitialized = false;

function initGoogleIfPossible(onCredential) {
  if (
    !CFG.GOOGLE_CLIENT_ID ||
    typeof google === "undefined" ||
    !google.accounts?.id
  )
    return;

  google.accounts.id.initialize({
    client_id: CFG.GOOGLE_CLIENT_ID,
    callback: async ({ credential }) => {
      try {
        await onCredential(credential);
      } catch (e) {
        console.error("Google Sign-in handler error:", e);
        showMsg("Lỗi Google Sign-in");
      }
    },
    ux_mode: "popup",
    use_fedcm_for_prompt: true,
  });
  _gisInitialized = true;
}

function setupGoogle(buttonEl, onCredential) {
  // Init GIS sau khi load
  function init() {
    if (!window.APP_CONFIG?.googleClientId) {
      showMsg("Chưa cấu hình GOOGLE_CLIENT_ID trên server.");
      return;
    }
    if (typeof google === "undefined" || !google.accounts?.id) {
      showMsg("Google chưa sẵn sàng, thử lại sau.");
      return;
    }

    // Khởi tạo với callback để nhận credential
    google.accounts.id.initialize({
      client_id: window.APP_CONFIG.googleClientId,
      callback: async ({ credential }) => {
        try {
          await onCredential(credential);
        } catch (e) {
          console.error(e);
          showMsg("Lỗi Google Sign-in");
        }
      },
      ux_mode: "popup",
      use_fedcm_for_prompt: true,
    });

    // --- Render nút Google "chuẩn" nhưng ẩn ---
    const hiddenWrap = document.createElement("div");
    hiddenWrap.style.position = "fixed";
    hiddenWrap.style.left = "-9999px"; // ẩn hẳn
    document.body.appendChild(hiddenWrap);

    google.accounts.id.renderButton(hiddenWrap, {
      theme: "outline",
      size: "large",
      width: 320,
    });

    // Tìm phần tử button thực tế mà Google render
    const triggerBtn = () =>
      hiddenWrap.querySelector('div[role="button"], iframe, button');

    // Nút custom của bạn -> kích hoạt nút ẩn
    buttonEl.addEventListener("click", () => {
      const gbtn = triggerBtn();
      if (gbtn && typeof gbtn.click === "function") {
        gbtn.click(); // mở popup/chooser chắc chắn
      } else {
        // fallback: thử dùng prompt
        if (google?.accounts?.id?.prompt) {
          google.accounts.id.prompt();
        } else {
          showMsg("Google chưa sẵn sàng, thử lại sau.");
        }
      }
    });
  }

  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
}
/* ---------- Boot ---------- */
(function boot() {
  attachRegister();
  attachLogin();
  attachForgot();
  attachReset();
})();
