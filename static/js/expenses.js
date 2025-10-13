// static/js/expenses.js
const Expenses = (() => {
  let state = {
    categories: [],
    expenses: [],
    filtered: [],
    currentCategory: "",
    editIndex: -1,
  };

  const money = (n) =>
    (n ?? 0).toLocaleString("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    });

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  /* -------------------- Mock (demo) -------------------- */
  const MOCK_CATEGORIES = [
    "Ăn uống",
    "Di chuyển",
    "Giải trí",
    "Mua sắm",
    "Học tập",
    "Sức khỏe",
  ];
  const MOCK_EXPENSES = [
     { date: '2025-09-28', category: 'Ăn uống', desc: 'Cơm trưa', amount: 50000, method: 'Tiền mặt' },
  { date: '2025-09-27', category: 'Di chuyển', desc: 'Xe bus', amount: 15000, method: 'Tiền mặt' },
  { date: '2025-09-26', category: 'Giải trí', desc: 'Xem phim', amount: 120000, method: 'Thẻ' },
  { date: '2025-09-25', category: 'Ăn uống', desc: 'Cà phê', amount: 45000, method: 'Tiền mặt' },
  { date: '2025-09-24', category: 'Mua sắm', desc: 'Quần áo', amount: 350000, method: 'Thẻ' },
  { date: '2025-09-23', category: 'Ăn uống', desc: 'Nhà hàng', amount: 200000, method: 'Thẻ' },
  { date: '2025-09-22', category: 'Di chuyển', desc: 'Grab', amount: 85000, method: 'Ví điện tử' },
  { date: '2025-09-21', category: 'Học tập', desc: 'Sách giáo trình', amount: 150000, method: 'Tiền mặt' },
  ];

  /* -------------------- Render helpers -------------------- */
  function setKPIs(list) {
    const total = list.reduce((s, x) => s + Number(x.amount || 0), 0);
    const count = list.length;
    const avg = count ? total / count : 0;
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
            <div class="fw-semibold">${tx.desc}</div>
            <div class="small text-muted">
              ${new Date(tx.date).toLocaleDateString("vi-VN")} · ${tx.method || "Tiền mặt"}
            </div>
          </div>

          <div class="d-flex align-items-center gap-3">
            <span class="badge badge-soft">${tx.category}</span>
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

  function buildCategoryMenu() {
    const menu = document.getElementById("categoryMenu");
    // xoá mục cũ (trừ item đầu “Tất cả danh mục”)
    menu.querySelectorAll("li:not(:first-child)").forEach((li) => li.remove());

    state.categories.forEach((cat) => {
      const li = document.createElement("li");
      li.innerHTML = `<a class="dropdown-item" data-value="${cat}">${cat}</a>`;
      menu.appendChild(li);
    });

    menu.onclick = (e) => {
      const a = e.target.closest("a.dropdown-item");
      if (!a) return;
      menu.querySelectorAll(".dropdown-item").forEach((x) => x.classList.remove("active"));
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

  function openEditModal(idx) {
    const form = document.getElementById("txForm");
    const tx = state.filtered[idx];
    if (!tx) return;

    // tìm index thực trong state.expenses
    const realIdx = state.expenses.findIndex(
      (x) =>
        x.date === tx.date &&
        x.desc === tx.desc &&
        x.category === tx.category &&
        Number(x.amount) === Number(tx.amount) &&
        (x.method || "") === (tx.method || "")
    );
    state.editIndex = realIdx >= 0 ? realIdx : idx;

    form.desc.value = tx.desc;
    form.amount.value = tx.amount;
    form.category.value = tx.category;
    form.date.value = tx.date;
    form.method.value = tx.method || "Tiền mặt";

    document.getElementById("txModalTitle").textContent = "Cập nhật chi tiêu";
    new bootstrap.Modal("#txModal").show();
  }

  function deleteItem(idxFiltered) {
    if (!confirm("Bạn chắc chắn muốn xóa giao dịch này?")) return;
    const target = state.filtered[idxFiltered];
    const realIdx = state.expenses.findIndex(
      (x) =>
        x.date === target.date &&
        x.desc === target.desc &&
        x.category === target.category &&
        Number(x.amount) === Number(target.amount) &&
        (x.method || "") === (target.method || "")
    );
    if (realIdx >= 0) state.expenses.splice(realIdx, 1);
    applyFilter();
  }

  function bindUI() {
    document.getElementById("addExpenseBtn").onclick = openAddModal;

    // click sửa/xoá trong list
    document.getElementById("txList").onclick = (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      const act = btn.dataset.action;
      if (act === "edit") openEditModal(idx);
      if (act === "del") deleteItem(idx);
    };

    // submit form
    document.getElementById("txForm").onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const tx = Object.fromEntries(fd.entries());
      tx.amount = Number(tx.amount);

      if (state.editIndex >= 0) {
        state.expenses[state.editIndex] = { ...state.expenses[state.editIndex], ...tx };
      } else {
        state.expenses.unshift(tx);
      }
      applyFilter();
      bootstrap.Modal.getInstance(document.getElementById("txModal")).hide();
      e.target.reset();
    };
  }

  function fillFormCategories() {
    const sel = document.querySelector('#txForm select[name="category"]');
    sel.innerHTML = state.categories.map((c) => `<option>${c}</option>`).join("");
  }

  /* -------------------- Init -------------------- */
  function init() {
    // load mock
    state.categories = [...MOCK_CATEGORIES];
    state.expenses = [...MOCK_EXPENSES];

    buildCategoryMenu();
    fillFormCategories();
    bindUI();
    document.querySelector('#txForm input[name="date"]').value = todayStr();
    applyFilter();
  }

  return { init };
})();
