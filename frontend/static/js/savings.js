// frontend/static/js/savings.js
(() => {
  const API_BASE = (window.BASE_API_URL || "").replace(/\/$/, "");
  const USE_API = !!API_BASE;
  const TOKEN = (localStorage.getItem("access_token") || "").trim();
  const AUTH_HEADERS = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

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

  let GOALS = [];

  // ===== API =====
  async function loadFromAPI() {
    const res = await fetch(`${API_BASE}/savings?status=active`, {
      headers: { ...AUTH_HEADERS },
    });
    if (!res.ok) throw new Error("load savings fail");
    const data = await res.json();
    GOALS = (data.items || []).map((g) => ({
      id: g.id,
      title: g.name,
      desc: g.description || "",
      target_amount: +g.target_amount || 0,
      current_amount: +g.current_amount || 0,
      monthly_contribution: +g.monthly_contribution || 0,
      target_date: g.deadline || "",
      status: g.status || "active",
      auto_contribute: !!g.auto_contribute,
      contribute_interval: g.contribute_interval || "monthly",
      icon: "💰",
    }));
  }

  async function apiContribute(id, amount) {
    const res = await fetch(`${API_BASE}/savings/${id}/contribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function apiDelete(id) {
    const res = await fetch(`${API_BASE}/savings/${id}`, {
      method: "DELETE",
      headers: { ...AUTH_HEADERS },
    });
    if (!res.ok) throw new Error(await res.text());
  }

  // ===== RENDER =====
  function badge(pri) {
    const t = pri === "high" ? "Cao" : pri === "low" ? "Thấp" : "Trung bình";
    const cls = pri === "high" ? "high" : pri === "low" ? "low" : "medium";
    return `<span class="chip ${cls}">${t}</span>`;
  }

  function cardHTML(g) {
    const p = pct(g.current_amount, g.target_amount);
    const overdue = g.status === "failed";
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
                <button class="icon-btn btn-view-detail" title="Chi tiết"><i class="bi bi-clock-history"></i></button>
                <button class="icon-btn btn-edit" title="Sửa"><i class="bi bi-pencil"></i></button>
                <button class="icon-btn btn-del"  title="Xóa"><i class="bi bi-trash"></i></button>
                ${
                  g.status === "completed"
                    ? '<button class="icon-btn btn-withdraw" title="Rút về ví"><i class="bi bi-wallet2"></i></button>'
                    : ""
                }
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
                g.status === "completed"
                  ? '<span class="text-success">Hoàn thành</span>'
                  : overdue
                  ? '<span class="text-danger">Quá hạn</span>'
                  : '<span class="text-success">Đúng tiến độ</span>'
              }
            </div>

            <div class="input-group mt-3">
              <input type="number" class="form-control add-amount" min="1000" step="1000" placeholder="Nhập số tiền (VND)">
              <button class="btn btn-outline-primary btn-add-custom">
                <i class="bi bi-plus-circle me-1"></i> Cộng vào
              </button>
            </div>

            <div class="border rounded-3 p-2 mt-3 bg-light-subtle small">
              <i class="bi bi-graph-up-arrow me-1"></i>
              Đóng góp ${
                g.contribute_interval === "weekly" ? "hằng tuần" : "hằng tháng"
              }:
              <b>${fmtVND(g.monthly_contribution || 0)}</b>
              ${
                g.auto_contribute
                  ? '<span class="badge text-bg-success ms-2" style="font-size:.7rem">Tự động</span>'
                  : '<span class="badge text-bg-secondary ms-2" style="font-size:.7rem">Thủ công</span>'
              }
              <div class="muted mt-1">Duy trì để đạt mục tiêu đúng hạn</div>
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

  function renderKPIs() {
    const totalSaved = GOALS.reduce((s, g) => s + (g.current_amount || 0), 0);
    const totalTarget = GOALS.reduce((s, g) => s + (g.target_amount || 0), 0);
    const monthly = GOALS.reduce(
      (s, g) => s + (g.monthly_contribution || 0),
      0
    );
    qs("#kpiSaved") && (qs("#kpiSaved").textContent = fmtVND(totalSaved));
    qs("#kpiTarget") && (qs("#kpiTarget").textContent = fmtVND(totalTarget));
    qs("#kpiMonthly") && (qs("#kpiMonthly").textContent = fmtVND(monthly));
  }

  // ===== Modal =====
  const modalEl = document.getElementById("goalModal");
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

  qs("#newGoalBtn")?.addEventListener("click", () => openModal(null));

  function fillForm(g) {
    const f = qs("#goalForm");
    f.id.value = g?.id || "";
    f.name.value = g?.title || "";
    f.description.value = g?.desc || "";
    f.target_amount.value = g?.target_amount || "";
    f.deadline.value = window.__SAVINGS_DATE__?.parseISO(g?.target_date) || "";
    f.monthly_contribution.value = g?.monthly_contribution || 0;
    f.auto_contribute.checked = !!g?.auto_contribute;
    f.contribute_interval.value = g?.contribute_interval || "monthly";
  }

  function openModal(id) {
    const g = id ? GOALS.find((x) => x.id == id) : null;
    qs("#goalModalTitle").textContent = g
      ? "Chỉnh sửa mục tiêu"
      : "Tạo mục tiêu tiết kiệm mới";
    fillForm(g);
    modal?.show();
  }

  qs("#goalForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const fd = Object.fromEntries(new FormData(f).entries());
    const dmyToISO = (s) =>
      (window.__SAVINGS_DATE__?.toISO && window.__SAVINGS_DATE__.toISO(s)) ||
      (s
        ? (() => {
            const [dd, mm, yyyy] = String(s).split("/");
            return `${yyyy}-${mm}-${dd}`;
          })()
        : null);
    const payload = {
      name: fd.name || "",
      description: fd.description || "",
      target_amount: Number(fd.target_amount || 0),
      monthly_contribution: Number(fd.monthly_contribution || 0),
      deadline: dmyToISO(fd.deadline),
      auto_contribute: !!fd.auto_contribute,
      contribute_interval: fd.contribute_interval || "monthly",
    };

    if (!fd.id) {
      // create
      await fetch(`${API_BASE}/savings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify(payload),
      });
    } else {
      // update
      await fetch(`${API_BASE}/savings/${fd.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify(payload),
      });
    }

    modal?.hide();
    await boot();
  });

  // ===== bind actions =====
  function bindCardEvents() {
    qsa("#goalsGrid [data-id]").forEach((card) => {
      const id = card.getAttribute("data-id");

      card
        .querySelector(".btn-edit")
        ?.addEventListener("click", () => openModal(id));

      card.querySelector(".btn-del")?.addEventListener("click", async () => {
        if (!confirm("Xóa mục tiêu này?")) return;
        await apiDelete(id);
        await boot();
      });

      const input = card.querySelector(".add-amount");
      const btn = card.querySelector(".btn-add-custom");
      const doAdd = async () => {
        const inc = Number(input.value || 0);
        if (inc <= 0) return;
        await apiContribute(id, inc);
        await boot();
      };
      btn?.addEventListener("click", doAdd);
      input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doAdd();
        }
      });

      card.querySelector(".btn-view-detail")?.addEventListener("click", () => {
        openModal(id); // tạm dùng modal hiện tại
      });

      card
        .querySelector(".btn-withdraw")
        ?.addEventListener("click", async () => {
          if (!confirm("Rút toàn bộ số tiền đã tiết kiệm về ví của bạn?"))
            return;
          const r = await fetch(`${API_BASE}/savings/${id}/withdraw`, {
            method: "POST",
            headers: { ...AUTH_HEADERS },
          });
          if (!r.ok) {
            alert("Rút tiền thất bại");
            return;
          }
          const { withdrawn = 0 } = await r.json();
          alert(
            `Đã rút ${Number(withdrawn).toLocaleString(
              "vi-VN"
            )} đ về ví của bạn.`
          );
          await boot();
        });
    });
  }

  // ===== start =====
  async function boot() {
    if (USE_API) {
      try {
        await loadFromAPI();
        // nếu BE trả notices: data.notices
        // (thêm return value trong loadFromAPI nếu muốn)
        // notices.forEach(n => toastWarning(n.message));
      } catch (e) {
        console.error(e);
        GOALS = [];
      }
    } else {
      GOALS = [];
    }
    render();
  }

  boot();
})();
