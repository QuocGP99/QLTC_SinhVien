/* ===== Savings Goals - DEMO first, API optional ===== */
(() => {
  // ====== Config / Storage keys ======
  const API_BASE = (window.BASE_API_URL || "").replace(/\/$/, "");
  const USE_API = !!API_BASE; // khi bạn set BASE_API_URL
  const STORE = "savings_goals_demo_v3"; // localStorage key
  const TOKEN = (localStorage.getItem("access_token") || "").trim();
  const AUTH_HEADERS = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

  // ====== Helpers ======
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => [...el.querySelectorAll(s)];
  const fmtVND = (n) =>
    Number(n || 0).toLocaleString("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    });
  const pct = (cur, tgt) =>
    tgt > 0 ? Math.min(100, Math.round((cur * 100) / tgt)) : 0;
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const CAT_ICON = {
    emergency: "🧯",
    tech: "💻",
    travel: "✈️",
    gift: "🎁",
    housing: "🏠",
    transportation: "🚌",
    personal: "🧑",
    other: "🔖",
    "": "💰",
  };

  // ====== State ======
  let GOALS = [];

  // ====== Load / Save ======
  function saveLocal() {
    localStorage.setItem(STORE, JSON.stringify(GOALS));
  }
  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) GOALS = JSON.parse(raw) || [];
    } catch {}
  }

  async function loadFromAPI() {
    if (!USE_API) return false;
    try {
      const res = await fetch(`${API_BASE}/savings`, {
        headers: { ...AUTH_HEADERS },
      });
      if (!res.ok) throw 0;
      const data = await res.json();
      GOALS = (data.items || data || []).map((g) => ({
        id: g.id,
        title: g.title,
        desc: g.description || "",
        target_amount: +g.target_amount || 0,
        current_amount: +g.current_amount || 0,
        monthly_contribution: +g.monthly_contribution || 0,
        category: g.category || "",
        priority: g.priority || "medium",
        target_date: g.target_date || "",
        icon: CAT_ICON[g.category] || "💰",
      }));
      return true;
    } catch {
      return false;
    }
  }

  async function apiContribute(id, amount) {
    // Nếu backend của bạn dùng POST /api/savings/:id/contribute
    const url = `${API_BASE}/savings/${id}/contribute`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // Gom lại trình tự boot để có thể gọi lại sau khi contribute thành công
  async function boot() {
    loadLocal();
    const ok = await loadFromAPI(); // nếu có API sẽ ghi đè demo
    if (!ok) seedDemoIfEmpty();
    render();
  }

  function seedDemoIfEmpty() {
    if (GOALS.length) return;
    GOALS = [
      {
        id: 1,
        title: "Quỹ khẩn cấp",
        desc: "3 tháng chi phí dự phòng",
        target_amount: 2000000,
        current_amount: 847000,
        monthly_contribution: 200000,
        category: "emergency",
        priority: "high",
        target_date: todayISO(),
        icon: "🧯",
      },
      {
        id: 2,
        title: "Mua MacBook mới",
        desc: "Phục vụ học tập & dự án",
        target_amount: 1200000,
        current_amount: 750000,
        monthly_contribution: 150000,
        category: "tech",
        priority: "medium",
        target_date: todayISO(),
        icon: "💻",
      },
      {
        id: 3,
        title: "Du lịch mùa xuân",
        desc: "Chuyến đi cùng bạn bè",
        target_amount: 800000,
        current_amount: 250000,
        monthly_contribution: 100000,
        category: "travel",
        priority: "low",
        target_date: todayISO(),
        icon: "✈️",
      },
      {
        id: 4,
        title: "Quà tốt nghiệp",
        desc: "Món quà nhỏ cho người thân",
        target_amount: 500000,
        current_amount: 125000,
        monthly_contribution: 75000,
        category: "gift",
        priority: "medium",
        target_date: todayISO(),
        icon: "🎁",
      },
    ];
    saveLocal();
  }

  // ====== KPI ======
  function renderKPIs() {
    const totalSaved = GOALS.reduce(
      (s, g) => s + Number(g.current_amount || 0),
      0
    );
    const totalTarget = GOALS.reduce(
      (s, g) => s + Number(g.target_amount || 0),
      0
    );
    const monthly = GOALS.reduce(
      (s, g) => s + Number(g.monthly_contribution || 0),
      0
    );
    qs("#kpiSaved") && (qs("#kpiSaved").textContent = fmtVND(totalSaved));
    qs("#kpiTarget") && (qs("#kpiTarget").textContent = fmtVND(totalTarget));
    qs("#kpiMonthly") && (qs("#kpiMonthly").textContent = fmtVND(monthly));
    qs("#kpiSavedSub") &&
      (qs("#kpiSavedSub").textContent = `${pct(
        totalSaved,
        totalTarget
      )}% mục tiêu`);
    qs("#kpiActive") &&
      (qs("#kpiActive").textContent = `${GOALS.length} mục tiêu đang theo dõi`);
  }

  // ====== Card ======
  function badge(pri) {
    const t = pri === "high" ? "Cao" : pri === "low" ? "Thấp" : "Trung bình";
    const cls = pri === "high" ? "high" : pri === "low" ? "low" : "medium";
    return `<span class="chip ${cls}">${t}</span>`;
  }

  function cardHTML(g) {
    const p = pct(g.current_amount, g.target_amount);
    const overdue =
      g.target_date &&
      new Date(g.target_date) < new Date(new Date().toDateString());
    return `
      <div class="col-xl-6" data-id="${g.id}">
        <div class="card goal-card shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div class="d-flex align-items-center gap-2">
                <div style="font-size:1.25rem">${g.icon || "💰"}</div>
                <div>
                  <div class="goal-title">${g.title}</div>
                  <div class="muted small">${g.desc || ""}</div>
                </div>
              </div>
              <div class="d-flex align-items-center gap-2 goal-actions">
                ${badge(g.priority || "medium")}
                <button class="icon-btn btn-edit" title="Sửa"><i class="bi bi-pencil"></i></button>
                <button class="icon-btn btn-del"  title="Xóa"><i class="bi bi-trash"></i></button>
              </div>
            </div>

            <div class="d-flex justify-content-between mt-3 mb-1">
              <div class="fw-semibold">${fmtVND(g.current_amount)}</div>
              <div class="muted">/ ${fmtVND(g.target_amount)}</div>
            </div>
            <div class="progress mb-1"><div class="progress-bar ${
              p >= 100 ? "bg-success" : "bg-dark"
            }" style="width:${p}%"></div></div>
            <div class="d-flex justify-content-between small">
              <span class="muted">${p}% hoàn thành</span>
              ${
                overdue
                  ? '<span class="text-danger">Quá hạn</span>'
                  : '<span class="text-success">Đúng tiến độ</span>'
              }
            </div>

            <!-- Ô nhập + Cộng -->
            <div class="input-group mt-3">
              <input type="number" class="form-control add-amount" min="1000" step="1000" placeholder="Nhập số tiền (VND)">
              <button class="btn btn-outline-primary btn-add-custom">
                <i class="bi bi-plus-circle me-1"></i> Cộng vào
              </button>
            </div>

            <div class="border rounded-3 p-2 mt-3 bg-light-subtle small">
              <i class="bi bi-graph-up-arrow me-1"></i>
              Đóng góp hằng tháng: <b>${fmtVND(g.monthly_contribution || 0)}</b>
              <span class="muted ms-2">Cố gắng duy trì để đạt mục tiêu đúng hạn</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  function render() {
    const wrap = qs("#goalsGrid") || qs("#savingsList");
    if (!wrap) return;
    wrap.innerHTML = GOALS.map(cardHTML).join("");
    renderKPIs();
    bindCardEvents();
  }

  // ====== Modal (create/edit) ======
  const modalEl = document.getElementById("goalModal");
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;
  qs("#newGoalBtn")?.addEventListener("click", () => openModal(null));

  function fillForm(g) {
    const f = qs("#goalForm");
    if (!f) return;
    f.id.value = g?.id || "";
    f.title.value = g?.title || "";
    f.description.value = g?.desc || "";
    f.target_amount.value = g?.target_amount || "";
    f.current_amount.value = g?.current_amount || 0;
    f.category.value = g?.category || "";
    f.priority.value = g?.priority || "medium";
    f.target_date.value = g?.target_date || "";
    f.monthly_contribution.value = g?.monthly_contribution || 0;
  }

  function openModal(goalId) {
    const g = goalId
      ? GOALS.find((x) => String(x.id) === String(goalId))
      : null;
    qs("#goalModalTitle").textContent = g
      ? "Chỉnh sửa mục tiêu"
      : "Tạo mục tiêu tiết kiệm mới";
    fillForm(g);
    modal?.show();
  }

  qs("#goalForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const formData = Object.fromEntries(new FormData(f).entries());
    // normalize
    ["target_amount", "current_amount", "monthly_contribution"].forEach(
      (k) => (formData[k] = Number(formData[k] || 0))
    );
    formData.icon = CAT_ICON[formData.category] || "💰";

    if (!formData.id) {
      // create
      if (USE_API) {
        try {
          const r = await fetch(`${API_BASE}/savings`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
            body: JSON.stringify(formData),
          });
          const created = await r.json();
          formData.id = created.id;
        } catch {}
      }
      formData.id =
        formData.id || Math.max(0, ...GOALS.map((x) => Number(x.id) || 0)) + 1;
      GOALS.push(formData);
    } else {
      // update
      const id = formData.id;
      if (USE_API) {
        try {
          await fetch(`${API_BASE}/savings/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
            body: JSON.stringify(formData),
          });
        } catch {}
      }
      const i = GOALS.findIndex((x) => String(x.id) === String(id));
      if (i > -1) GOALS[i] = { ...GOALS[i], ...formData, id };
    }

    saveLocal();
    modal?.hide();
    render();
  });

  // ====== Card actions ======
  function bindCardEvents() {
    qsa("[data-id]").forEach((card) => {
      const id = card.getAttribute("data-id");

      // Edit
      card
        .querySelector(".btn-edit")
        ?.addEventListener("click", () => openModal(id));

      // Delete
      card.querySelector(".btn-del")?.addEventListener("click", async () => {
        if (!confirm("Xoá mục tiêu này?")) return;
        if (USE_API) {
          try {
            await fetch(`${API_BASE}/savings/${id}`, {
              method: "DELETE",
              headers: { ...AUTH_HEADERS },
            });
          } catch {}
        }
        GOALS = GOALS.filter((g) => String(g.id) !== String(id));
        saveLocal();
        render();
        input.value = "";
      });

      // Add money: Enter or button
      const input = card.querySelector(".add-amount");
      const btn = card.querySelector(".btn-add-custom");

      const doAdd = async () => {
        const inc = Number(input.value || 0);
        if (!inc || inc <= 0) {
          input.focus();
          return;
        }

        if (USE_API) {
          try {
            await apiContribute(id, inc);
            await boot(); // refresh lại từ server
            return;
          } catch (e) {
            console.error(e);
            alert("Cộng tiền thất bại.");
            return;
          }
        }

        // Fallback demo (không có API)
        const g = GOALS.find((x) => String(x.id) === String(id));
        g.current_amount = Math.min(
          g.target_amount,
          (g.current_amount || 0) + inc
        );
        saveLocal();
        render();
      };

      btn?.addEventListener("click", doAdd);
      input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doAdd();
        }
      });
    });
  }

  boot();
})();
