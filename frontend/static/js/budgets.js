// static/js/budgets.js
const BudgetPage = (() => {
  let modalInstance = null;
  let editing = null;

  const qs = (s, r = document) => r.querySelector(s);
  const money = (n) => (Number(n) || 0).toLocaleString("vi-VN") + " đ";
  const pad2 = (n) => String(n).padStart(2, "0");

  const now = new Date();
  const state = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    cats: [], // [{id,name}]
    items: [],
    kpi: { total: 0, spent: 0, remain: 0 },
    loading: false,
  };

  function authHeaders() {
    const h = {};
    const t = localStorage.getItem("access_token");
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
  }
  async function apiGet(url) {
    const r = await fetch(url, {
      headers: authHeaders(),
      credentials: "same-origin",
    });
    return r.json();
  }
  async function apiSend(method, url, body) {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : null,
    });
    return r.json();
  }

  // ---- load categories (expense) for modal
  async function loadCats() {
    const r = await apiGet("/api/expenses/meta");
    state.cats = r?.success ? r.categories || [] : [];
    const sel = qs("#budgetCategory");
    if (sel) {
      sel.innerHTML = state.cats
        .map((c) => `<option value="${c.id}">${c.name}</option>`)
        .join("");
      if (state.cats[0]) sel.value = state.cats[0].id;
    }
  }

  // ---- Modal
  async function openModal(mode = "add", item = null) {
    if (!modalInstance) modalInstance = new bootstrap.Modal(qs("#budgetModal"));
    await loadCats(); // nạp danh mục expense vào select

    const form = qs("#budgetForm");
    const title = qs("#budgetModalTitle");
    if (mode === "edit" && item) {
      editing = item;
      title.textContent = "Cập nhật ngân sách";
      form.category.value = item.category_id;
      form.amount.value = item.amount ?? item.limit ?? 0;
    } else {
      editing = null;
      title.textContent = "Thêm danh mục ngân sách";
      form.reset();
      if (state.cats[0]) form.category.value = state.cats[0].id;
    }
    modalInstance.show();
  }
  function closeModal() {
    modalInstance?.hide();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const f = e.target;
    const category_id = Number(f.category.value);
    const amount = Number(f.amount.value);
    if (!category_id || !(amount > 0)) {
      alert("Vui lòng chọn danh mục và số tiền > 0");
      return;
    }
    const payload = {
      month: `${state.year}-${pad2(state.month)}`,
      category_id,
      amount,
    };
    if (editing) {
      await apiSend("PUT", `/api/budgets/${editing.id}`, payload);
    } else {
      await apiSend("POST", `/api/budgets/`, payload);
    }
    closeModal();
    await load();
  }

  // ---- Render
  function renderKPIs() {
    qs("#kpiTotal").textContent = money(state.kpi.total);
    qs("#kpiSpent").textContent = money(state.kpi.spent);
    qs("#kpiRemain").textContent = money(state.kpi.remain);
  }

  function renderList() {
    const wrap = qs("#categoryList");
    wrap.innerHTML = "";
    if (!state.items.length) {
      wrap.innerHTML = `<div class="text-center text-muted py-4">Chưa có ngân sách cho tháng này</div>`;
      return;
    }
    state.items.forEach((it) => {
      const limit = Number(it.amount ?? it.limit ?? 0);
      const spent = Number(it.spent ?? it.used ?? 0);
      const pct = Number.isFinite(it.percent_used)
        ? Math.round(it.percent_used)
        : limit
        ? Math.min(100, Math.round((spent * 100) / limit))
        : 0;
      const remain = Math.max(0, limit - spent);
      const barCls =
        pct < 70 ? "bg-success" : pct < 90 ? "bg-warning" : "bg-danger";

      const card = document.createElement("div");
      card.className = "card card-rounded border-0 shadow-sm";
      card.innerHTML = `
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div class="fw-semibold">${
              it.category || it.category_name || "Danh mục"
            }</div>
            <div class="d-flex align-items-center gap-2 text-muted small">
              <span>${money(spent)} / ${money(limit)}</span>
              <i class="bi bi-pencil-square action-btn" data-action="edit" data-id="${
                it.id
              }" title="Sửa"></i>
              <i class="bi bi-trash action-btn" data-action="del" data-id="${
                it.id
              }" title="Xóa"></i>
            </div>
          </div>
          <div class="progress" style="height:10px">
            <div class="progress-bar ${barCls}" style="width:${pct}%"></div>
          </div>
          <div class="d-flex justify-content-between small mt-1">
            <span>${pct}% đã dùng</span>
            <span>${money(remain)} còn lại</span>
          </div>
        </div>`;
      wrap.appendChild(card);
    });
  }

  async function onListClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = state.items.find((x) => x.id === id);
    if (btn.dataset.action === "edit") return openModal("edit", item);
    if (btn.dataset.action === "del") {
      if (!confirm("Xóa ngân sách này?")) return;
      await apiSend("DELETE", `/api/budgets/${id}`);
      await load();
    }
  }

  // ---- Load summary
  async function load() {
    const monthStr = `${state.year}-${pad2(state.month)}`;
    const resp = await apiGet(`/api/budgets/summary?month=${monthStr}`);
    const data = resp?.data || {};
    state.items = data.items || [];
    state.kpi = {
      total: Number(data.total_budget || 0),
      spent: Number(data.total_spent || 0),
      remain: Number(data.total_remaining || 0),
    };
    renderKPIs();
    renderList();

    // --- GHI DỮ LIỆU CHO CHUÔNG CẢNH BÁO ---
    try {
      const normalized = state.items.map((it) => ({
        category: it.category || it.category_name || "Không rõ danh mục",
        limit: Number(it.amount ?? it.limit ?? it.budget ?? 0),
        spent: Number(it.spent ?? it.used ?? it.expense ?? 0),
      }));
      localStorage.setItem("budget_data", JSON.stringify(normalized));
    } catch (err) {
      console.warn("Không thể lưu budget_data:", err);
    }

    // Nếu notify.js đã load, tự refresh
    if (window.BudgetNotify?.render) {
      window.BudgetNotify.render();
    }
  }

  function bind() {
    qs("#btnAddBudget")?.addEventListener("click", () => openModal("add"));
    qs("#budgetForm")?.addEventListener("submit", onSubmit);
    qs("#categoryList")?.addEventListener("click", onListClick);
  }
  async function init() {
    bind();
    await load();
  }
  return { init };
})();
