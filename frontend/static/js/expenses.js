// frontend/static/js/expenses.js
const ExpensesPage = (() => {
  // ===== STATE =====
  let state = {
    categories: [],
    methods: [],
    items: [],
    filtered: [],
    currentCategoryId: "",
    editId: null,
  };

  // ===== Date utils =====
  let dp = null,
    dateMode = "none";

  function toISODate(s) {
    if (!s) return "";
    // "dd/mm/yyyy" -> "yyyy-mm-dd"
    if (s.includes("/")) {
      const [d, m, y] = s.split("/");
      const pad = (n) => String(n).padStart(2, "0");
      return `${y}-${pad(m)}-${pad(d)}`;
    }
    return s;
  }

  function ensureDatepicker() {
    const el = document.getElementById("expenseDate");
    const btn = document.getElementById("btnOpenExpenseCalendar");
    if (!el) return;

    // ưu tiên bootstrap-datepicker (jquery)
    if (window.jQuery && jQuery.fn?.datepicker) {
      const $ = window.jQuery;
      $(el).datepicker({
        format: "dd/mm/yyyy",
        autoclose: true,
        todayHighlight: true,
        language: "vi",
      });
      dateMode = "bootstrap";
      if (btn) btn.onclick = () => $(el).datepicker("show");
      return;
    }

    // fallback vanilla datepicker lib (Datepicker global)
    if (window.Datepicker) {
      dp =
        dp ||
        new Datepicker(el, {
          language: "vi",
          format: "dd/mm/yyyy",
          autohide: true,
          buttonClass: "btn btn-sm btn-outline-secondary",
        });
      dateMode = "vanilla";
      if (btn) btn.onclick = () => dp.show();
      return;
    }

    // cuối cùng: không có datepicker -> disable nút mở lịch
    dateMode = "none";
    if (btn) btn.disabled = true;
  }

  function setDateField(dateObj) {
    const el = document.getElementById("expenseDate");
    if (!el) return;
    const pad = (n) => String(n).padStart(2, "0");

    if (dateMode === "bootstrap") {
      window.jQuery(el).datepicker("setDate", dateObj);
    } else if (dateMode === "vanilla") {
      ensureDatepicker();
      dp.setDate(dateObj);
    } else {
      el.value = `${pad(dateObj.getDate())}/${pad(
        dateObj.getMonth() + 1
      )}/${dateObj.getFullYear()}`;
    }
  }

  function getDateField() {
    const el = document.getElementById("expenseDate");
    if (!el) return "";
    if (dateMode === "bootstrap") {
      return window.jQuery(el).datepicker("getFormattedDate", "dd/mm/yyyy");
    }
    return el.value || "";
  }

  // ===== API =====
  const API_BASE = window.BASE_API_URL || "http://127.0.0.1:5000";

  function token() {
    return localStorage.getItem("access_token") || "";
  }

  function authHeaders(json = false) {
    const t = token();
    const h = json ? { "Content-Type": "application/json" } : {};
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  }

  async function safeJson(res) {
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) return res.json();
    throw new Error(await res.text());
  }

  async function apiGet(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = API_BASE + path + (qs ? `?${qs}` : "");
    return safeJson(
      await fetch(url, {
        headers: authHeaders(),
      })
    );
  }

  async function apiPost(path, body) {
    return safeJson(
      await fetch(API_BASE + path, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(body),
      })
    );
  }

  async function apiPatch(path, body) {
    return safeJson(
      await fetch(API_BASE + path, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify(body),
      })
    );
  }

  async function apiDelete(path) {
    return safeJson(
      await fetch(API_BASE + path, {
        method: "DELETE",
        headers: authHeaders(),
      })
    );
  }

  const API = {
    list: (params = {}) => apiGet("/api/expenses", params),
    create: (payload) => apiPost("/api/expenses", payload),
    update: (id, body) => apiPatch(`/api/expenses/${id}`, body),
    remove: (id) => apiDelete(`/api/expenses/${id}`),
    meta: () => apiGet("/api/expenses/meta"),
  };

  // ===== Helpers & render =====
  const money = (n) =>
    (Number(n) || 0).toLocaleString("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    });

  const moneyNeg = (n) => `-${money(n)}`;

  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  function setKPIs(list) {
    const total = list.reduce((s, x) => s + Number(x.amount || 0), 0);
    const cnt = list.length || 1;

    const kpiTotal = document.getElementById("kpiTotal");
    const kpiCount = document.getElementById("kpiCount");
    const kpiAvg = document.getElementById("kpiAvg");

    if (kpiTotal) kpiTotal.textContent = moneyNeg(total);
    if (kpiCount) kpiCount.textContent = list.length;
    if (kpiAvg) kpiAvg.textContent = money(total / cnt);
  }

  function renderList() {
    const wrap = document.getElementById("txList");
    if (!wrap) return;

    wrap.innerHTML = "";
    if (!state.filtered.length) {
      wrap.innerHTML =
        '<div class="text-muted small fst-italic">Chưa có chi tiêu.</div>';
      return;
    }

    state.filtered.forEach((tx) => {
      const dateFormatted = tx.date
        ? new Date(tx.date).toLocaleDateString("vi-VN")
        : "";

      const el = document.createElement("div");
      el.className = "expense-card";
      el.innerHTML = `
        <div class="card-body d-flex align-items-start justify-content-between">
          <div class="me-3">
            <div class="fw-semibold">${escapeHtml(
              tx.description || tx.desc || tx.note || ""
            )}</div>
            <div class="small text-muted">
              ${dateFormatted} · ${tx.method_name || tx.method || "Tiền mặt"}
            </div>
          </div>

          <div class="d-flex align-items-center gap-3">
            <span class="badge badge-soft" data-cat-id="${tx.category_id}">
              ${escapeHtml(tx.category || tx.category_name || "")}
            </span>

            <div class="amount text-danger">${moneyNeg(tx.amount)}</div>

            <div class="text-muted d-flex gap-2">
              <button class="btn btn-sm btn-link text-muted px-1"
                      title="Sửa"
                      data-action="edit"
                      data-id="${tx.id}">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-sm btn-link text-muted px-1"
                      title="Xóa"
                      data-action="del"
                      data-id="${tx.id}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`;
      wrap.appendChild(el);
    });
  }

  async function loadMeta() {
    const data = await API.meta();
    state.categories = data?.categories || [];
    state.methods = data?.methods || [];

    // Đổ danh mục vào select trong modal
    const selCat = document.getElementById("expenseCategory");
    if (selCat) {
      selCat.innerHTML = `<option value="">-- Chọn danh mục chi tiêu --</option>`;
      state.categories
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "vi"))
        .forEach((c) => {
          selCat.insertAdjacentHTML(
            "beforeend",
            `<option value="${c.id}">${escapeHtml(c.name)}</option>`
          );
        });
    }

    // Đổ phương thức thanh toán
    const selPm = document.getElementById("expensePaymentMethod");
    if (selPm) {
      selPm.innerHTML = `<option value="">-- Chọn phương thức thanh toán --</option>`;
      state.methods.forEach((m) => {
        selPm.insertAdjacentHTML(
          "beforeend",
          `<option value="${m.id}">${escapeHtml(m.name)}</option>`
        );
      });
    }

    buildFilterMenu();
  }

  function buildFilterMenu() {
    const menu = document.getElementById("categoryMenu");
    const btn = document.getElementById("categoryFilterBtn");
    if (!menu || !btn) return;

    // clear tất cả item cũ ngoại trừ dòng đầu tiên
    menu.querySelectorAll("li:not(:first-child)").forEach((li) => li.remove());

    const cats = state.categories
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));

    cats.forEach((c) => {
      const li = document.createElement("li");
      li.innerHTML = `<a class="dropdown-item" data-id="${c.id}">${escapeHtml(
        c.name
      )}</a>`;
      menu.appendChild(li);
    });

    menu.onclick = (e) => {
      const a = e.target.closest("a.dropdown-item");
      if (!a) return;

      menu
        .querySelectorAll(".dropdown-item")
        .forEach((x) => x.classList.remove("active"));
      a.classList.add("active");

      state.currentCategoryId = a.dataset.id || "";

      const found = cats.find(
        (x) => String(x.id) === String(state.currentCategoryId)
      );
      btn.textContent = state.currentCategoryId
        ? found?.name || "Danh mục"
        : "Tất cả danh mục";

      applyFilter();
    };
  }

  function applyFilter() {
    const cid = state.currentCategoryId;
    state.filtered = cid
      ? state.items.filter((x) => String(x.category_id) === String(cid))
      : [...state.items];

    renderList();
    setKPIs(state.items); // KPI theo toàn bộ tháng, không chỉ filter
  }

  // ===== Modal / Form =====
  function expenseModalEl() {
    return document.getElementById("expenseModal");
  }

  function getExpenseModal() {
    return bootstrap.Modal.getOrCreateInstance(expenseModalEl());
  }

  // mở modal thêm mới
  function openAdd() {
    state.editId = null;
    const form = document.getElementById("expenseForm");
    if (!form) return;

    form.reset();
    ensureDatepicker();
    setDateField(new Date());

    // đặt tiêu đề modal + nút submit
    const titleEl = expenseModalEl().querySelector(".modal-title");
    if (titleEl) titleEl.textContent = "Thêm chi tiêu mới";

    const submitBtn = document.getElementById("expenseSubmitBtn");
    if (submitBtn) submitBtn.textContent = "Lưu chi tiêu";

    getExpenseModal().show();
  }

  async function openEdit(id) {
    const tx = state.items.find((t) => String(t.id) === String(id));
    if (!tx) return;
    state.editId = tx.id;

    // đảm bảo meta đã load để có options
    await loadMeta();

    const form = document.getElementById("expenseForm");
    if (!form) return;
    form.reset();

    // fill form
    if (form.desc) form.desc.value = tx.description || tx.desc || tx.note || "";
    if (form.amount) form.amount.value = tx.amount;
    if (form.category_id) form.category_id.value = tx.category_id;
    if (form.payment_method_id) {
      form.payment_method_id.value =
        tx.payment_method_id ||
        tx.method_id ||
        (state.methods[0] && state.methods[0].id) ||
        "";
    }

    ensureDatepicker();
    setDateField(tx.date ? new Date(tx.date) : new Date());

    // UI modal
    const titleEl = expenseModalEl().querySelector(".modal-title");
    if (titleEl) titleEl.textContent = "Cập nhật chi tiêu";

    const submitBtn = document.getElementById("expenseSubmitBtn");
    if (submitBtn) submitBtn.textContent = "Lưu thay đổi";

    getExpenseModal().show();
  }

  async function removeItem(id) {
    if (!confirm("Xoá chi tiêu này?")) return;
    const res = await API.remove(id);
    if (!res?.success) {
      alert(res?.message || "Xoá thất bại");
      return;
    }
    state.items = state.items.filter((x) => x.id !== Number(id));
    buildFilterMenu();
    applyFilter();
  }

  function bindUI() {
    // nút "Thêm chi tiêu"
    const btnAdd = document.getElementById("addExpenseBtn");
    if (btnAdd) {
      btnAdd.addEventListener("click", (e) => {
        e.preventDefault();
        openAdd();
      });
    }

    // click Sửa / Xóa trong danh sách
    const listWrap = document.getElementById("txList");
    if (listWrap) {
      listWrap.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === "edit") openEdit(id);
        if (btn.dataset.action === "del") removeItem(id);
      });
    }

    // submit form chi tiêu
    const form = document.getElementById("expenseForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const fd = new FormData(form);

        const payload = {
          amount: Number(fd.get("amount") || 0),
          category_id: Number(fd.get("category_id") || 0),
          payment_method_id: Number(fd.get("payment_method_id") || 0),
          description: (fd.get("desc") || fd.get("note") || "").trim(),
          date: toISODate(fd.get("date") || getDateField()),
          type: "expense",
        };

        if (payload.amount <= 0 || !payload.category_id) {
          alert("Vui lòng nhập số tiền > 0 và chọn danh mục.");
          return;
        }

        const submitBtn = document.getElementById("expenseSubmitBtn");
        if (submitBtn) submitBtn.disabled = true;

        try {
          if (state.editId) {
            const res = await API.update(state.editId, payload);
            if (!res?.success)
              throw new Error(res?.message || "Cập nhật thất bại");

            // cập nhật item trong state
            const idx = state.items.findIndex((t) => t.id === state.editId);
            if (idx !== -1) state.items[idx] = res.item;
          } else {
            const res = await API.create(payload);
            if (!res?.success)
              throw new Error(res?.message || "Tạo chi tiêu thất bại");

            // thêm item mới lên đầu
            state.items.unshift(res.item);
          }

          buildFilterMenu();
          applyFilter();

          // đóng modal
          getExpenseModal().hide();

          // reset form + state.editId
          form.reset();
          ensureDatepicker();
          setDateField(new Date());
          state.editId = null;
        } catch (err) {
          alert(err.message || "Có lỗi xảy ra");
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  // ===== INIT =====
  async function init(opts = {}) {
    // 1. Chuẩn datepicker trước
    ensureDatepicker();

    // 2. Load danh mục & phương thức thanh toán & dựng dropdown filter
    await loadMeta();

    // 3. Lấy danh sách chi tiêu từ BE
    const exp = await API.list({});
    state.items = (exp?.items || []).map((x) => ({ ...x, type: "expense" }));
    // sort mới nhất lên đầu
    state.items.sort(
      (a, b) => (b.date || "").localeCompare(a.date || "") || b.id - a.id
    );

    // 4. Gắn sự kiện UI
    bindUI();

    // 5. Render list ban đầu + KPI
    applyFilter();

    // 6. Autofill focus input mô tả sau khi modal show (UX)
    const modal = expenseModalEl();
    if (modal) {
      modal.addEventListener(
        "shown.bs.modal",
        () => {
          modal.querySelector('input[name="desc"]')?.focus();
        },
        { once: true }
      );
      modal.addEventListener("hidden.bs.modal", () => {
        document.getElementById("expenseForm")?.reset();
      });
    }
    if (opts.autoOpen) {
      openAdd(); // openAdd() sẽ set default date, reset form, và show modal
    }
  }

  return { init };
})();
