// static/js/expenses.js
const Expenses = (() => {
  let state = {
    categories: [],
    methods: [],
    expenses: [],
    filtered: [],
    currentCategory: "",
    editIndex: -1, // index trong state.expenses
  };

  const API_BASE = window.BASE_API_URL || ""; // base được truyền từ Flask
  const API = {
    list: (params = {}) => apiGet("/api/expenses", params),
    create: (payload) => apiPost("/api/expenses", payload),
    update: (id, payload) => apiPatch(`/api/expenses/${id}`, payload),
    remove: (id) => apiDelete(`/api/expenses/${id}`),
    meta: () => apiGet("/api/expenses/meta"),
  };

  function token() {
    return localStorage.getItem("access_token") || "";
  }

  async function apiGet(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = API_BASE + path + (qs ? `?${qs}` : "");
    const res = await fetch(url, {
      headers: {
        Authorization: token() ? `Bearer ${token()}` : undefined,
      },
    });
    return res.json();
  }
  async function apiPost(path, body) {
    const res = await fetch(API_BASE + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token() ? `Bearer ${token()}` : undefined,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }
  async function apiPatch(path, body) {
    const res = await fetch(API_BASE + path, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: token() ? `Bearer ${token()}` : undefined,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }
  async function apiDelete(path) {
    const res = await fetch(API_BASE + path, {
      method: "DELETE",
      headers: {
        Authorization: token() ? `Bearer ${token()}` : undefined,
      },
    });
    return res.json();
  }

  const money = (n) =>
    (n ?? 0).toLocaleString("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    });

  const todayStr = () => new Date().toISOString().slice(0, 10);

  /* -------------------- Render helpers -------------------- */
  function setKPIs(list) {
    const total = list.reduce((s, x) => s + Number(x.amount || 0), 0);
    const count = list.length;
    const avg = count ? Math.floor(total / count) : 0;
    const q = (id) => document.getElementById(id);
    q("kpiTotal").textContent = money(total);
    q("kpiCount").textContent = count;
    q("kpiAvg").textContent = money(avg);
  }

  function renderList() {
    const wrap = document.getElementById("txList");
    wrap.innerHTML = "";

    if (!state.filtered.length) {
      wrap.innerHTML = `<div class="text-muted">Chưa có giao dịch.</div>`;
      return;
    }

    state.filtered.forEach((tx, i) => {
      const el = document.createElement("div");
      el.className = "expense-card";
      el.innerHTML = `
        <div class="card-body d-flex align-items-start justify-content-between">
          <div class="me-3">
            <div class="fw-semibold">${escapeHtml(tx.desc)}</div>
            <div class="small text-muted">
              ${new Date(tx.date).toLocaleDateString("vi-VN")} · ${
        tx.method || "Tiền mặt"
      }
            </div>
          </div>

          <div class="d-flex align-items-center gap-3">
          <span class="badge badge-soft" data-cat="${tx.category}">${
        tx.category
      }</span>
            <div class="amount">${money(tx.amount)}</div>

            <div class="text-muted d-flex gap-2">
              <button class="btn btn-sm btn-link text-muted px-1" title="Sửa" data-action="edit" data-idx="${i}">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-sm btn-link text-muted px-1" title="Xóa" data-action="del" data-idx="${i}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`;
      wrap.appendChild(el);
    });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function buildCategoryMenu() {
    const menu = document.getElementById("categoryMenu");
    // giữ lại item đầu
    menu.querySelectorAll("li:not(:first-child)").forEach((li) => li.remove());

    state.categories.forEach((cat) => {
      const li = document.createElement("li");
      li.innerHTML = `<a class="dropdown-item" data-value="${cat}">${cat}</a>`;
      menu.appendChild(li);
    });

    menu.onclick = (e) => {
      const a = e.target.closest("a.dropdown-item");
      if (!a) return;
      menu
        .querySelectorAll(".dropdown-item")
        .forEach((x) => x.classList.remove("active"));
      a.classList.add("active");
      state.currentCategory = a.dataset.value || "";
      document.getElementById("categoryFilterBtn").textContent =
        state.currentCategory || "Tất cả danh mục";
      applyFilter();
    };
  }

  function applyFilter() {
    state.filtered = state.currentCategory
      ? state.expenses.filter((x) => x.category === state.currentCategory)
      : [...state.expenses];
    renderList();
    setKPIs(state.filtered);
  }

  /* -------------------- Modal / Form -------------------- */
  function openAddModal() {
    state.editIndex = -1;
    const form = document.getElementById("txForm");
    form.reset();
    form.date.value = todayStr();
    if (state.categories[0]) form.category.value = state.categories[0];
    document.getElementById("txModalTitle").textContent = "Thêm chi tiêu mới";
    new bootstrap.Modal("#txModal").show();
  }

  function openEditModal(idxFiltered) {
    const tx = state.filtered[idxFiltered];
    if (!tx) return;
    const realIdx = state.expenses.findIndex((x) => x.id === tx.id);
    state.editIndex = realIdx >= 0 ? realIdx : idxFiltered;

    const form = document.getElementById("txForm");
    form.desc.value = tx.desc;
    form.amount.value = tx.amount;
    form.category.value = tx.category;
    form.date.value = tx.date;
    form.method.value = tx.method || "Tiền mặt";

    document.getElementById("txModalTitle").textContent = "Cập nhật chi tiêu";
    new bootstrap.Modal("#txModal").show();
  }

  async function deleteItem(idxFiltered) {
    const target = state.filtered[idxFiltered];
    if (!target) return;
    if (!confirm("Bạn chắc chắn muốn xóa giao dịch này?")) return;

    const { success, message } = await API.remove(target.id);
    if (!success) {
      alert(message || "Xóa thất bại");
      return;
    }
    // xóa trong local state
    state.expenses = state.expenses.filter((x) => x.id !== target.id);
    applyFilter();
  }

  function bindUI() {
    document.getElementById("addExpenseBtn").onclick = openAddModal;

    document.getElementById("txList").onclick = (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      const act = btn.dataset.action;
      if (act === "edit") openEditModal(idx);
      if (act === "del") deleteItem(idx);
    };

    document.getElementById("txForm").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const tx = Object.fromEntries(fd.entries());
      tx.amount = Number(tx.amount);

      if (state.editIndex >= 0) {
        // update
        const current = state.expenses[state.editIndex];
        const payload = {
          desc: tx.desc,
          amount: tx.amount,
          category: tx.category,
          date: tx.date,
          method: tx.method,
        };
        const { success, item, message } = await API.update(
          current.id,
          payload
        );
        if (!success) {
          alert(message || "Cập nhật thất bại");
          return;
        }
        state.expenses[state.editIndex] = item;
      } else {
        // create
        const payload = {
          desc: tx.desc,
          amount: tx.amount,
          category: tx.category,
          date: tx.date,
          method: tx.method,
        };
        const { success, item, message } = await API.create(payload);
        if (!success) {
          alert(message || "Tạo mới thất bại");
          return;
        }
        state.expenses.unshift(item);
      }
      applyFilter();
      bootstrap.Modal.getInstance(document.getElementById("txModal")).hide();
      e.target.reset();
    };
  }

  function fillFormCategories() {
    const sel = document.querySelector('#txForm select[name="category"]');
    sel.innerHTML = state.categories
      .map((c) => `<option>${c}</option>`)
      .join("");
  }

  function fillFormMethods() {
    const sel = document.querySelector('#txForm select[name="method"]');
    // giữ các method sẵn có nếu backend trả rỗng
    if (state.methods.length) {
      sel.innerHTML = state.methods
        .map((m) => `<option>${m}</option>`)
        .join("");
    }
  }

  /* -------------------- Init -------------------- */
  async function init() {
    try {
      // meta: danh mục + phương thức
      const meta = await API.meta();
      if (meta?.success) {
        state.categories = meta.categories || [];
        state.methods = meta.methods || [];
      }
      buildCategoryMenu();
      fillFormCategories();
      fillFormMethods();

      // list expenses + KPI
      const resp = await API.list({
        // có thể truyền filter mặc định nếu cần
      });
      if (resp?.success) {
        state.expenses = resp.items || [];
      } else {
        state.expenses = [];
      }

      bindUI();
      document.querySelector('#txForm input[name="date"]').value = todayStr();
      applyFilter();
    } catch (err) {
      console.error(err);
      alert("Không tải được dữ liệu chi tiêu");
    }
  }

  return { init };
})();
