// static/js/budgets.js
const BudgetPage = (() => {
  let modalInstance = null;
  let editing = null;

  const qs = (sel, root = document) => root.querySelector(sel);
  const money = (n) => (Number(n) || 0).toLocaleString("vi-VN") + " đ";

  // ---- Endpoint ----
  const CATS_URL = "/api/categories?type=budget";
  const pad2 = (n) => String(n).padStart(2, "0");
  const BUDGETS_URL = (y, m) => `/api/budgets?month=${y}-${pad2(m)}`;

  // ---- State ----
  const now = new Date();
  const state = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    cats: [],
    items: [],
    kpi: { total: 0, spent: 0, remain: 0 },
    loading: false,
    error: null,
  };

  /* ---------------- Helpers: Auth / CSRF / API ---------------- */
  function getCsrfHeaders() {
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    return token ? { "X-CSRFToken": token } : {};
  }

  // Lấy JWT từ localStorage và gắn vào Authorization header
  function getAuthHeaders() {
    const headers = { ...getCsrfHeaders() };
    const token = localStorage.getItem("access_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async function apiGet(url) {
    const r = await fetch(url, {
      credentials: "same-origin",
      headers: { ...getAuthHeaders() },
    });
    if (r.ok) return r.json();

    // Nếu token hết hạn/không hợp lệ -> thông báo & yêu cầu đăng nhập lại (an toàn hơn là retry không token)
    if (r.status === 401) {
      localStorage.removeItem("access_token");
      throw new Error(
        JSON.stringify({
          msg: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        })
      );
    }
    throw new Error(await r.text());
  }

  async function apiSend(method, url, body) {
    const r = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : null,
    });
    if (!r.ok) {
      if (r.status === 401) {
        localStorage.removeItem("access_token");
        throw new Error(
          JSON.stringify({
            msg: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
          })
        );
      }
      throw new Error(await r.text());
    }
    try {
      return await r.json();
    } catch {
      return {};
    }
  }

  function showNiceError(err) {
    try {
      const j = JSON.parse(err.message);
      alert("Lỗi: " + (j.msg || j.message || err.message));
    } catch {
      alert("Lỗi: " + (err.message || err));
    }
  }

  /* ---------------- Chuẩn hoá dữ liệu categories ---------------- */
  function normalizeCats(raw) {
    const arr = Array.isArray(raw)
      ? raw
      : raw && Array.isArray(raw.items)
      ? raw.items
      : [];
    return arr
      .map((c) => ({
        id: Number(c.id ?? c.category_id),
        name: String(c.name ?? c.title ?? c.category ?? "").trim(),
      }))
      .filter((c) => c.id && c.name);
  }

  async function ensureCatsLoaded() {
    if (state.cats.length) return;
    const res = await apiGet(CATS_URL);
    state.cats = normalizeCats(res);
  }

  function fillCategorySelect() {
    const sel = qs("#budgetCategory");
    if (!sel) return;
    if (!state.cats.length) {
      sel.innerHTML = `<option value="">(Chưa có danh mục)</option>`;
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    sel.innerHTML = state.cats
      .map((c) => `<option value="${c.id}">${c.name}</option>`)
      .join("");
  }

  /* ---------------- Modal ---------------- */
  async function openModal(mode = "add", item = null) {
    await ensureCatsLoaded(); // đảm bảo có categories trước khi mở
    if (!modalInstance) modalInstance = new bootstrap.Modal(qs("#budgetModal"));

    const form = qs("#budgetForm");
    const title = qs("#budgetModalTitle");
    fillCategorySelect();

    if (mode === "edit" && item) {
      editing = item;
      title.textContent = "Cập nhật ngân sách";
      form.category.value = item.category_id; // value là ID
      form.amount.value = item.limit; // dùng 'limit' (API có alias 'amount' bên server)
    } else {
      editing = null;
      title.textContent = "Thêm danh mục ngân sách";
      form.reset();
      if (state.cats[0]) form.category.value = state.cats[0].id;
    }
    modalInstance.show();
  }
  const closeModal = () => modalInstance?.hide();

  async function onSubmit(e) {
    e.preventDefault();
    const f = e.target;

    // validate
    const categoryId = Number(f.category.value);
    const amount = Number(f.amount.value);
    if (!categoryId || isNaN(amount) || amount <= 0) {
      alert("Vui lòng chọn danh mục và nhập số tiền hợp lệ (> 0).");
      return;
    }
    // gửi đúng định dạng backend yêu cầu
    const payload = {
      month: `${state.year}-${pad2(state.month)}`,
      category_id: categoryId,
      amount: amount, // ✅ chỉ gửi amount; không gửi limit_amount
    };

    try {
      if (editing) {
        await apiSend("PUT", `/api/budgets/${editing.id}`, {
          category_id: payload.category_id,
          amount: payload.amount,
        });
      } else {
        await apiSend("POST", `/api/budgets`, payload);
      }
      closeModal();
      await load();
    } catch (err) {
      showNiceError(err);
    }
  }

  /* ---------------- Render ---------------- */
  function renderKPIs() {
    qs("#kpiTotal").textContent = money(state.kpi.total);
    qs("#kpiSpent").textContent = money(state.kpi.spent);
    qs("#kpiRemain").textContent = money(state.kpi.remain);
  }

  function renderEmpty() {
    const wrap = qs("#categoryList");
    wrap.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="bi bi-inboxes"></i>
        <div class="mt-1">Chưa có ngân sách nào cho tháng này</div>
      </div>
    `;
  }

  function renderLoading() {
    const wrap = qs("#categoryList");
    wrap.innerHTML = `
      <div class="text-center text-muted py-4">
        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
        Đang tải...
      </div>
    `;
  }

  function renderList() {
    const wrap = qs("#categoryList");
    if (state.loading) return renderLoading();
    if (!state.items.length) return renderEmpty();

    wrap.innerHTML = "";
    state.items.forEach((it) => {
      const pct = it.limit
        ? Math.min(100, Math.round((it.spent / it.limit) * 100))
        : 0;
      const bar =
        pct < 70 ? "bg-success" : pct < 90 ? "bg-warning" : "bg-danger";
      const remain = Math.max(0, it.limit - it.spent);

      const card = document.createElement("div");
      card.className = "border rounded p-3 shadow-sm budget-card";
      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="fw-semibold">${it.category}</div>
          <div class="d-flex align-items-center gap-2 text-muted">
            <small>${money(it.spent)} / ${money(it.limit)}</small>
            <i class="bi bi-pencil-square action-btn" title="Sửa" data-action="edit" data-id="${
              it.id
            }"></i>
            <i class="bi bi-trash action-btn" title="Xóa" data-action="del" data-id="${
              it.id
            }"></i>
          </div>
        </div>
        <div class="progress mb-2" style="height:8px;">
          <div class="progress-bar ${bar}" style="width:${pct}%"></div>
        </div>
        <div class="d-flex justify-content-between small">
          <span>${pct}% đã dùng</span>
          <span>${money(remain)} còn lại</span>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  /* ---------------- Delete / Edit click ---------------- */
  async function onListClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = state.items.find((x) => x.id === id);
    const action = btn.dataset.action;

    if (action === "edit") return openModal("edit", item);
    if (action === "del") {
      if (!confirm("Bạn chắc chắn muốn xóa ngân sách này?")) return;
      try {
        await apiSend("DELETE", `/api/budgets/${id}`);
        await load();
      } catch (err) {
        showNiceError(err);
      }
    }
  }

  /* ---------------- Data load ---------------- */
  async function load() {
    const [catsRaw, budgets] = await Promise.all([
      apiGet(CATS_URL).catch(() => ({ items: [] })),
      apiGet(BUDGETS_URL(state.year, state.month)).catch((err) => {
        showNiceError(err);
        return { items: [], kpi: { total: 0, spent: 0, remain: 0 } };
      }),
    ]);
    state.cats = normalizeCats(catsRaw);
    state.items = budgets.items || [];
    state.kpi = budgets.kpi || { total: 0, spent: 0, remain: 0 };
    renderKPIs();
    renderList();
  }

  /* ---------------- Init ---------------- */
  function bindEvents() {
    qs("#btnAddBudget")?.addEventListener("click", () => openModal("add"));
    qs("#budgetForm")?.addEventListener("submit", onSubmit);
    qs("#categoryList")?.addEventListener("click", onListClick);
  }

  async function init() {
    bindEvents();
    await load();
  }

  return { init };
})();

window.addEventListener("DOMContentLoaded", () => BudgetPage.init());
