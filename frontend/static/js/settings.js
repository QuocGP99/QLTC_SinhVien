// --- HÀM HIỂN THỊ TOAST THÔNG BÁO ---
function showSettingsToast(msg, isError = false) {
  const typeMap = {
    success: { bg: "bg-success text-white", icon: "bi-check-circle" },
    error: { bg: "bg-danger text-white", icon: "bi-exclamation-triangle" },
    warning: { bg: "bg-warning", icon: "bi-exclamation-circle" },
    info: { bg: "bg-primary text-white", icon: "bi-info-circle" },
  };

  const type = isError ? "error" : "success";
  const t = typeMap[type];

  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "position-fixed top-0 end-0 p-3";
    container.style.zIndex = "1080";
    document.body.appendChild(container);
  }

  const el = document.createElement("div");
  el.className = `toast align-items-center ${t.bg}`;
  el.setAttribute("role", "alert");
  el.setAttribute("aria-live", "assertive");
  el.setAttribute("aria-atomic", "true");
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi ${t.icon} me-2"></i>${msg}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  container.appendChild(el);
  const bsToast = new bootstrap.Toast(el);
  bsToast.show();
}

// --- 1. HÀM CẬP NHẬT GIAO DIỆN AVATAR (MỚI) ---
// Dùng để cập nhật URL ảnh đại diện trên Navbar và Dropdown.
const updateNavbarAvatar = (newAvatarUrl) => {
  // ID: navUserAvatar (Avatar nhỏ trên Navbar)
  const avatarEl = document.getElementById("navUserAvatar");

  // ID MỚI: navUserAvatarDropdown (Avatar lớn trong Dropdown, đã được fix trong _navbar.html)
  const avatarDropdownEl = document.getElementById("navUserAvatarDropdown");

  if (avatarEl) avatarEl.src = newAvatarUrl;
  if (avatarDropdownEl) avatarDropdownEl.src = newAvatarUrl;
};

// Hàm chính bao bọc toàn bộ logic
(function () {
  const TKEY = "sf_settings_v1";
  // Hàm load/save đơn giản (nếu chưa được định nghĩa toàn cục)
  const load = () => JSON.parse(localStorage.getItem(TKEY) || "{}");
  const save = (obj) => {
    localStorage.setItem(TKEY, JSON.stringify(obj));
    // ❌ BỎ showSettingsToast ở đây để tránh thông báo trùng lặp
  };

  const st = load();

  // ===== 1. Thông tin cá nhân (profileForm) =====
  const pf = document.getElementById("profileForm");
  if (pf) {
    pf.fullName.value = st.fullName || "";

    pf.addEventListener("submit", (e) => {
      e.preventDefault();

      const formData = new FormData(pf);
      const data = Object.fromEntries(formData.entries());
      const avatarFile = formData.get("avatarFile");

      let user = JSON.parse(localStorage.getItem("user") || "{}");
      const oldFullName = user.full_name || st.fullName;
      const newFullName = data.fullName;
      const fullNameChanged = oldFullName !== newFullName;

      st.fullName = newFullName;
      user.full_name = newFullName;

      const navUserName = document.getElementById("navUserName");
      if (navUserName) {
        navUserName.textContent = newFullName || "Sinh viên";
      }

      // --- XỬ LÝ TẢIAU ---
      if (avatarFile && avatarFile.size > 0) {
        e.preventDefault();

        fetch("/api/user/upload-avatar", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access_token"),
          },
          body: formData,
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("Lỗi Server: " + response.statusText);
            }
            return response.json();
          })
          .then((result) => {
            // Lưu avatar từ database (endpoint trả về avatar_url)
            const newAvatarUrl = result.avatar_url || result.avatar;

            // Lưu vào localStorage (bỏ /uploads/ prefix vì API đã include)
            const avatarPath = newAvatarUrl
              ? newAvatarUrl.replace("/uploads/avatars/", "")
              : null;
            user.avatar = avatarPath;
            user.full_name = data.fullName;
            localStorage.setItem("user", JSON.stringify(user));

            if (typeof initNavbar === "function") {
              // Gọi hàm cập nhật navbar từ _navbar.html
              initNavbar();
            } else if (typeof updateNavbarAvatar !== "undefined") {
              // Fallback: cập nhật avatar trực tiếp
              updateNavbarAvatar(avatarUrl);
            }

            pf.querySelector("#avatarFile").value = "";
            pf.querySelector("#avatarFileName").textContent =
              "Chưa có tệp nào được chọn";

            st.fullName = data.fullName;
            save(st);
            pf.fullName.value = st.fullName;

            // ✅ CHỈ HIỂN THỊ 1 THÔNG BÁO CUỐI CÙNG
            showSettingsToast("Đã cập nhật tên và tải ảnh thành công!");
          })
          .catch((error) => {
            console.error("Lỗi Upload:", error);
            showSettingsToast("Lỗi khi tải ảnh: " + error.message, true);

            pf.querySelector("#avatarFile").value = "";
            pf.querySelector("#avatarFileName").textContent =
              "Chưa có tệp nào được chọn";
          });

        return;
      }

      localStorage.setItem("user", JSON.stringify(user));
      save(st);
      pf.fullName.value = st.fullName;

      // ✅ CHỈ HIỂN THỊ 1 THÔNG BÁO
      if (fullNameChanged) {
        showSettingsToast("Đã cập nhật tên thành công!");
      } else {
        showSettingsToast("Đã lưu thông tin cá nhân!");
      }
    });
  }

  // ===== 2. Tuỳ chọn (prefsForm) =====
  const pr = document.getElementById("prefsForm");
  if (pr) {
    pr.lang.value = st.lang || "vi";
    pr.currency.value = st.currency || "VND";
    pr.compact.checked = !!st.compact;

    if (window.ThemeManager) ThemeManager.applyCurrent();

    pr.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(pr).entries());

      const oldLang = st.lang;

      st.lang = data.lang;
      st.currency = data.currency;
      st.compact = pr.compact.checked;

      save(st);

      if (oldLang !== st.lang) {
        localStorage.setItem("lang_pref", st.lang);
        showSettingsToast("Đã lưu và đang tải lại giao diện...");
        setTimeout(() => {
          location.reload();
        }, 1000);
      } else {
        showSettingsToast("Đã lưu tuỳ chọn!");
      }
    });
  }

  // ===== 3. Thông báo (notifyForm) =====
  const nf = document.getElementById("notifyForm");
  if (nf) {
    nf.emailTx.checked = !!st.emailTx;
    nf.budgetAlert.checked = !!st.budgetAlert;
    nf.savingReminder.checked = !!st.savingReminder;

    nf.addEventListener("submit", (e) => {
      e.preventDefault();
      st.emailTx = nf.emailTx.checked;
      st.budgetAlert = nf.budgetAlert.checked;
      st.savingReminder = nf.savingReminder.checked;
      save(st);
      showSettingsToast("Đã lưu tuỳ chọn thông báo!");
    });
  }

  // ===== 4. Dữ liệu & AI (integrForm) =====
  const it = document.getElementById("integrForm");
  if (it) {
    it.ai_classify.checked = !!st.ai_classify;
    it.ai_suggest.checked = !!st.ai_suggest;
    it.charts.checked = st.charts ?? true;

    it.addEventListener("submit", (e) => {
      e.preventDefault();
      st.ai_classify = it.ai_classify.checked;
      st.ai_suggest = it.ai_suggest.checked;
      st.charts = it.charts.checked;

      if (window.APP_CONFIG) {
        window.APP_CONFIG.FEATURE_FLAGS = {
          ai_classify: st.ai_classify,
          ai_suggest: st.ai_suggest,
          charts: st.charts,
        };
      }
      save(st);
      showSettingsToast("Đã lưu tuỳ chọn Dữ liệu & AI!");
    });
  }

  // ===== 5. Đổi mật khẩu (pwdForm) =====
  const pw = document.getElementById("pwdForm");
  if (pw) {
    pw.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(pw).entries());
      if (f.new1 !== f.new2) {
        showSettingsToast("Mật khẩu nhập lại không khớp!", true);
        return;
      }
      showSettingsToast("Yêu cầu đổi mật khẩu đã được xử lý.");
      pw.reset();
    });
  }

  // ===== 6. Xóa tài khoản (deleteForm) =====
  const dl = document.getElementById("deleteForm");
  if (dl) {
    dl.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (
        !confirm(
          "Bạn có chắc chắn muốn xóa tài khoản? Hành động này không thể hoàn tác."
        )
      ) {
        return;
      }

      showSettingsToast("Yêu cầu xóa tài khoản đã được xử lý.");
    });
  }
})();
