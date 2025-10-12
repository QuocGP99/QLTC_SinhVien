// frontend/static/js/expenses.js
(function () {
  const API =
    window.BASE_API_URL && window.BASE_API_URL.length > 0
      ? window.BASE_API_URL
      : "/api";
  const token = () => localStorage.getItem("access_token") || "";
  const authHeader = () => ({ Authorization: `Bearer ${token()}` });

  const q = (sel) => document.querySelector(sel);
  const money = (n) =>
    (Number(n) || 0).toLocaleString("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    });
  const todayStr = () => new Date().toISOString().slice(0, 10);

  // --- modal & form (không xoá file, tự nhận diện) ---
  const modalEl = q("#txModal") || q("#expenseModal");
  const formEl = q("#txForm") || q("#expenseForm");
  if (!modalEl || !formEl) {
    console.warn("Thiếu modal/form expenses");
    return;
  }
  const modal = new bootstrap.Modal(modalEl);

  // map field theo cả 2 phiên bản
  const fieldDesc = formEl.querySelector('[name="desc"], [name="note"]');
  const fieldAmount = formEl.querySelector('[name="amount"]');
  let fieldCatId = formEl.querySelector('select[name="category_id"]');
  const fieldCatByName = formEl.querySelector('select[name="category"]');
  const fieldDate = formEl.querySelector('[name="date"], [name="occurred_on"]');
  const fieldMethod = formEl.querySelector(
    '[name="method"], [name="payment_method"]'
  );
  const titleEl =
    document.getElementById("txModalTitle") ||
    modalEl.querySelector(".modal-title");

  // alert nổi
  const alertBox = (() => {
    const host = document.querySelector(".page-wrap") || document.body;
    const box = document.createElement("div");
    box.id = "alertBox";
    box.className = "alert d-none";
    host.prepend(box);
    return box;
  })();
  const showAlert = (m, ok = true) => {
    alertBox.className = `alert ${ok ? "alert-success" : "alert-danger"}`;
    alertBox.textContent = m;
    alertBox.classList.remove("d-none");
    setTimeout(() => alertBox.classList.add("d-none"), 1800);
  };

  // state
  let items = [];
  let categories = []; // {id, name}
  let currentId = "";

  // helpers
  const catNameById = (id) =>
    categories.find((c) => c.id === Number(id))?.name || "";
  const catIdByName = (name) =>
    categories.find((c) => c.name === name)?.id || null;

  // ===== KHÔNG tạo trùng select "Danh mục" =====
  function ensureCategoryIdField() {
    // 1) Nếu đã có <select name="category_id"> thì dùng luôn
    fieldCatId = formEl.querySelector('select[name="category_id"]');
    if (fieldCatId) return;

    // 2) Nếu có <select name="category"> theo tên → ĐỔI name => category_id để dùng với API
    const selByName = formEl.querySelector('select[name="category"]');
    if (selByName) {
      selByName.setAttribute("name", "category_id");
      fieldCatId = selByName;

      const label = selByName.closest(".mb-3")?.querySelector(".form-label");
      if (label) label.textContent = "Danh mục";

      // nếu từng có select category_id do JS tạo → xoá các bản dư
      const dups = [...formEl.querySelectorAll('select[name="category_id"]')]
        .filter((el) => el !== fieldCatId)
        .map((el) => el.closest(".mb-3") || el);
      dups.forEach((el) => el.remove());
      return;
    }

    // 3) Không có gì → tạo mới
    const group = document.createElement("div");
    group.className = "mb-3";
    group.innerHTML = `
      <label class="form-label">Danh mục</label>
      <select name="category_id" class="form-select"></select>
    `;
    const anchor = formEl.querySelector(".modal-body") || formEl;
    anchor.appendChild(group);
    fieldCatId = group.querySelector('select[name="category_id"]');
  }

  // ===== Đổ options và giữ nguyên lựa chọn (kèm placeholder nếu rỗng) =====
  function fillCategorySelect() {
    ensureCategoryIdField();
    if (!fieldCatId) return;

    const current = fieldCatId.value; // giữ lựa chọn cũ nếu có

    if (!Array.isArray(categories) || categories.length === 0) {
      fieldCatId.innerHTML = `<option value="">— Chưa có danh mục —</option>`;
      fieldCatId.value = "";
      return;
    }

    fieldCatId.innerHTML = categories
      .map((c) => `<option value="${c.id}">${c.name}</option>`)
      .join("");

    // sync từ select theo tên (nếu còn) sang id
    if (fieldCatByName && fieldCatByName.value && !current) {
      const id = catIdByName(fieldCatByName.value);
      if (id) fieldCatId.value = String(id);
    }

    // khôi phục hoặc set mặc định
    if (current && categories.some((c) => String(c.id) === String(current))) {
      fieldCatId.value = current;
    } else if (fieldCatId.options.length) {
      fieldCatId.value = fieldCatId.options[0].value;
    }
  }

  // KPI + list
  function setKPIs(list) {
    const total = list.reduce((s, x) => s + Number(x.amount || 0), 0);
    const count = list.length;
    const avg = count ? total / count : 0;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set("kpiTotal", money(total));
    set("kpiCount", count);
    set("kpiAvg", money(avg));
  }

  function renderList() {
    const wrap = document.getElementById("txList");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!items.length) {
      wrap.innerHTML = `<div class="text-muted">Chưa có giao dịch.</div>`;
      setKPIs([]);
      return;
    }
    items.forEach((e) => {
      const el = document.createElement("div");
      el.className = "expense-card";
      const catLabel = e.category_name || catNameById(e.category_id) || "";
      el.innerHTML = `
        <div class="card-body d-flex align-items-start justify-content-between">
          <div class="me-3">
            <div class="fw-semibold">${e.note || ""}</div>
            <div class="small text-muted">${e.occurred_on || ""} · ${
        e.payment_method || "Tiền mặt"
      }</div>
          </div>
          <div class="d-flex align-items-center gap-3">
            <span class="badge badge-soft">${catLabel}</span>
            <div class="amount">${money(e.amount)}</div>
            <div class="text-muted d-flex gap-2">
              <button class="btn btn-sm btn-link text-muted px-1" title="Sửa" data-action="edit" data-id="${
                e.id
              }">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-sm btn-link text-muted px-1" title="Xóa" data-action="del" data-id="${
                e.id
              }">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`;
      wrap.appendChild(el);
    });
    setKPIs(items);
  }

  // open modal
  function openAdd() {
    currentId = "";
    fieldDesc && (fieldDesc.value = "");
    fieldAmount && (fieldAmount.value = "");
    fieldDate && (fieldDate.value = todayStr());
    fieldMethod &&
      (fieldMethod.value =
        fieldMethod.tagName === "SELECT"
          ? fieldMethod.options[0]?.value || "Tiền mặt"
          : "Tiền mặt");

    ensureCategoryIdField();
    // chọn option đầu sau khi đã có categories
    if (fieldCatId && fieldCatId.options.length) {
      fieldCatId.value = fieldCatId.options[0].value;
    }

    if (titleEl) titleEl.textContent = "Thêm chi tiêu mới";
    modal.show();
  }

  // openEdit – thêm option tạm nếu danh mục chưa có trong list
  async function openEdit(id) {
    const res = await fetch(`${API}/expenses/${id}`, {
      headers: { ...authHeader() },
    });
    if (!res.ok) return showAlert("Không lấy được chi tiết khoản chi.", false);
    const { expense } = await res.json();
    currentId = String(expense.id || "");

    fieldDesc && (fieldDesc.value = expense.note || "");
    fieldAmount && (fieldAmount.value = expense.amount || 0);
    fieldDate && (fieldDate.value = expense.occurred_on || todayStr());
    fieldMethod && (fieldMethod.value = expense.payment_method || "Tiền mặt");

    ensureCategoryIdField();
    // nếu chưa load categories thì load
    if (!categories || categories.length === 0) await loadCategories();
    fillCategorySelect();

    const cid = expense.category_id || catIdByName(expense.category_name);
    const cname = expense.category_name || expense.category;
    if (fieldCatId) {
      // nếu id không có trong select hiện tại -> thêm option tạm
      if (
        cid &&
        ![...fieldCatId.options].some((o) => String(o.value) === String(cid))
      ) {
        const opt = document.createElement("option");
        opt.value = String(cid);
        opt.textContent = cname || `#${cid}`;
        fieldCatId.appendChild(opt);
      }
      if (cid) fieldCatId.value = String(cid);
    }

    if (titleEl) titleEl.textContent = "Cập nhật chi tiêu";
    modal.show();
  }

  // ===== LOAD CATEGORIES: bỏ header Authorization + thêm log & fallback =====
  async function loadCategories() {
    try {
      const res = await fetch(`${API}/categories`);
      if (!res.ok) {
        console.error("GET /categories failed", res.status);
        showAlert(`Không tải được danh mục (HTTP ${res.status})`, false);
        categories = [];
        fillCategorySelect();
        buildFilterMenu();
        return;
      }
      const json = await res.json();
      categories = json && json.items ? json.items : [];
      if (!Array.isArray(categories)) categories = [];

      fillCategorySelect();
      buildFilterMenu(); // fill dropdown filter
    } catch (e) {
      console.error("GET /categories error", e);
      showAlert("Lỗi mạng khi tải danh mục", false);
      categories = [];
      fillCategorySelect();
      buildFilterMenu();
    }
  }

  function buildFilterMenu() {
    const menu = document.getElementById("categoryMenu");
    const btn = document.getElementById("categoryFilterBtn");
    if (!menu || !btn) return;
    menu.querySelectorAll("li:not(:first-child)").forEach((li) => li.remove());

    if (!Array.isArray(categories) || categories.length === 0) {
      // không có danh mục → giữ mỗi item “Tất cả danh mục”
      return;
    }

    categories.forEach((c) => {
      const li = document.createElement("li");
      li.innerHTML = `<a class="dropdown-item" data-value="${c.id}">${c.name}</a>`;
      menu.appendChild(li);
    });
    menu.onclick = async (e) => {
      const a = e.target.closest("a.dropdown-item");
      if (!a) return;
      menu
        .querySelectorAll(".dropdown-item")
        .forEach((x) => x.classList.remove("active"));
      a.classList.add("active");
      btn.textContent = a.textContent;
      await loadExpenses({ category_id: a.dataset.value || "" });
    };
  }

  async function loadExpenses(query = {}) {
    const qs = new URLSearchParams(query).toString();
    const res = await fetch(`${API}/expenses${qs ? "?" + qs : ""}`, {
      headers: { ...authHeader() },
    });
    if (res.status === 401) {
      showAlert("Hết phiên đăng nhập. Vui lòng login lại.", false);
      setTimeout(() => (location.href = "/login"), 800);
      return;
    }
    if (!res.ok) {
      showAlert(`Không tải được dữ liệu (HTTP ${res.status})`, false);
      return;
    }
    const json = await res.json();
    const data = json.data || { items: [] };
    items = data.items || [];
    renderList();
  }

  async function saveCurrent(e) {
    e.preventDefault();
    ensureCategoryIdField();
    const payload = {
      amount: Number(fieldAmount?.value || 0),
      category_id: fieldCatId?.value
        ? Number(fieldCatId.value)
        : fieldCatByName?.value
        ? catIdByName(fieldCatByName.value)
        : null,
      occurred_on: fieldDate?.value || todayStr(),
      note: fieldDesc?.value || "",
      payment_method: fieldMethod?.value || "Tiền mặt",
    };
    const method = currentId ? "PUT" : "POST";
    const url = currentId ? `${API}/expenses/${currentId}` : `${API}/expenses`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      showAlert(`Lưu thất bại (HTTP ${res.status})`, false);
      return;
    }
    modal.hide();
    showAlert("Đã lưu!");
    await loadExpenses();
  }

  async function removeById(id) {
    if (!confirm("Xoá khoản chi này?")) return;
    const res = await fetch(`${API}/expenses/${id}`, {
      method: "DELETE",
      headers: { ...authHeader() },
    });
    if (!res.ok) {
      showAlert("Xoá thất bại.", false);
      return;
    }
    showAlert("Đã xoá!");
    await loadExpenses();
  }

  // bind UI
  function bindUI() {
    document
      .getElementById("addExpenseBtn")
      ?.addEventListener("click", openAdd);
    document.getElementById("txList")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === "edit") openEdit(id);
      if (btn.dataset.action === "del") removeById(id);
    });
    formEl.addEventListener("submit", saveCurrent);
  }

  // init
  (async function init() {
    if (!token()) {
      location.href = "/login";
      return;
    }
    await loadCategories();
    await loadExpenses();
    bindUI();
  })();
})();
