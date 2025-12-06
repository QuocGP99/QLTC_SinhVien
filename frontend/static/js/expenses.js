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
    groupByMonth: true,
  };

  // ===== Date utils =====
  let dp = null,
    dateMode = "none";

  function toISODate(s) {
    if (!s) return "";
    if (s.includes("/")) {
      const [d, m, y] = s.split("/");
      const pad = (n) => String(n).padStart(2, "0");
      return `${y}-${pad(m)}-${pad(d)}`;
    }
    return s;
  }

  // ===== FIXED DATEPICKER (FULL SUPPORT) =====
  function ensureDatepicker() {
    const el = document.getElementById("expenseDate");
    const btn = document.getElementById("btnOpenExpenseCalendar");
    if (!el) return;

    // 1. Bootstrap Datepicker
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

    // 2. Vanilla Datepicker
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

    // 3. Native fallback
    el.type = "date";
    dateMode = "native";
    if (btn) {
      btn.disabled = false;
      btn.onclick = () => {
        if (el.showPicker) el.showPicker();
        else el.focus();
      };
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

  function setDateField(dateObj) {
    const el = document.getElementById("expenseDate");
    if (!el) return;

    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = dateObj.getFullYear();
    const mm = pad(dateObj.getMonth() + 1);
    const dd = pad(dateObj.getDate());

    if (dateMode === "bootstrap") {
      window.jQuery(el).datepicker("setDate", dateObj);
    } else if (dateMode === "vanilla") {
      ensureDatepicker();
      dp.setDate(dateObj);
    } else if (dateMode === "native") {
      el.value = `${yyyy}-${mm}-${dd}`;
    } else {
      el.value = `${dd}/${mm}/${yyyy}`;
    }
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

  // ===== Helpers =====
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

  // ===== Group-by-Month =====
  function monthKey(isoDate) {
    const d = new Date(isoDate);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function monthTitleFromKey(key) {
    const [y, m] = key.split("-");
    return `Tháng ${Number(m)}/${y}`;
  }

  function sumAmount(rows) {
    return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }

  function formatDateVN(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function groupByMonth(rows) {
    const map = new Map();
    rows.forEach((r) => {
      const key = monthKey(r.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    for (const key of map.keys()) {
      map.get(key).sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, items]) => ({
        key,
        title: monthTitleFromKey(key),
        items,
        total: sumAmount(items),
      }));
  }

  function renderTransactionsMonthly(rows) {
    const acc = document.getElementById("monthlyAccordion");
    if (!acc) return;

    if (!rows.length) {
      acc.innerHTML = `<div class="text-center text-muted py-4">Không có giao dịch nào</div>`;
      return;
    }

    const groups = groupByMonth(rows);
    acc.innerHTML = "";
    const frag = document.createDocumentFragment();

    groups.forEach((g) => {
      const item = document.createElement("div");
      item.className = "accordion-item mb-2 border-0";

      const collapseId = `mcollapse-${g.key}`;
      const headingId = `mheading-${g.key}`;

      item.innerHTML = `
      <h2 class="accordion-header" id="${headingId}">
        <button class="accordion-button collapsed py-3" type="button"
                data-bs-toggle="collapse" data-bs-target="#${collapseId}"
                aria-expanded="false" aria-controls="${collapseId}">
          <div class="d-flex w-100 justify-content-between align-items-center">
            <span class="fw-semibold">${g.title}</span>
            <span class="badge text-bg-light month-total-badge">
              Tổng chi: ${money(g.total)}
            </span>
          </div>
        </button>
      </h2>
      <div id="${collapseId}" class="accordion-collapse collapse"
           aria-labelledby="${headingId}" data-bs-parent="#monthlyAccordion">
        <div class="accordion-body pt-2"></div>
      </div>
    `;

      const body = item.querySelector(".accordion-body");
      const bodyFrag = document.createDocumentFragment();

      g.items.forEach((tx) => {
        const isIncome =
          String(tx.type || tx.kind || "").toLowerCase() === "income";
        const sign = isIncome ? "+" : "−";
        const cls = isIncome ? "text-success" : "text-danger";
        const catName = tx.category || tx.category_name || "";
        const method = tx.method_name || tx.method || "Tiền mặt";
        const catSlug = (catName || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const row = document.createElement("div");
        row.className = "expense-card p-3 mb-2";
        row.innerHTML = `
        <div class="d-flex justify-content-between">
          <div>
            <div class="fw-medium">
              ${escapeHtml(tx.description || tx.desc || tx.note || "")}
              ${
                catName
                  ? `<span class="cat-chip cat--${catSlug} ms-2"
                      data-cat-id="${tx.category_id}">
                      ${escapeHtml(catName)}
                    </span>`
                  : ""
              }
            </div>
            <div class="text-muted small">${formatDateVN(
              tx.date
            )} · ${escapeHtml(method)}</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <div class="fw-semibold ${cls}">${sign}${money(tx.amount)}</div>
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
        </div>
      `;
        bodyFrag.appendChild(row);
      });

      body.appendChild(bodyFrag);
      frag.appendChild(item);
    });

    acc.appendChild(frag);
  }

  function expandAllMonths() {
    document
      .querySelectorAll("#monthlyAccordion .accordion-collapse")
      .forEach((el) => {
        const c = new bootstrap.Collapse(el, { toggle: false });
        c.show();
      });
  }

  function collapseAllMonths() {
    document
      .querySelectorAll("#monthlyAccordion .accordion-collapse")
      .forEach((el) => {
        const c = new bootstrap.Collapse(el, { toggle: false });
        c.hide();
      });
  }
  // ===== FLAT LIST =====
  function renderListFlat(rows) {
    const wrap = document.getElementById("txList");
    if (!wrap) return;

    wrap.innerHTML = "";
    if (!rows.length) {
      wrap.innerHTML =
        '<div class="text-muted small fst-italic">Chưa có chi tiêu.</div>';
      return;
    }

    rows.forEach((tx) => {
      const dateFormatted = tx.date
        ? new Date(tx.date).toLocaleDateString("vi-VN")
        : "";

      const catName = tx.category || tx.category_name || "";
      const catSlug = catName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const catClass = catSlug ? `cat-chip cat--${catSlug}` : "cat-chip";

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
          <span class="${catClass}" data-cat-id="${tx.category_id}">
            ${escapeHtml(catName)}
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

  function renderList() {
    const monthlyAcc = document.getElementById("monthlyAccordion");
    const listFlat = document.getElementById("txList");
    const rows = state.filtered;

    if (state.groupByMonth && monthlyAcc) {
      monthlyAcc.style.display = "";
      if (listFlat) listFlat.style.display = "none";
      renderTransactionsMonthly(rows);
    } else {
      if (monthlyAcc) monthlyAcc.style.display = "none";
      if (listFlat) {
        listFlat.style.display = "";
        renderListFlat(rows);
      }
    }
  }

  // ===== LOAD META =====
  async function loadMeta() {
    const data = await API.meta();
    state.categories = data?.categories || [];
    state.methods = data?.methods || [];

    // Danh mục
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

    // Phương thức thanh toán
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
    setKPIs(state.items);
  }
  // ===== MODAL / FORM =====
  function expenseModalEl() {
    return document.getElementById("expenseModal");
  }

  function getExpenseModal() {
    return bootstrap.Modal.getOrCreateInstance(expenseModalEl());
  }

  function openAdd() {
    state.editId = null;
    const form = document.getElementById("expenseForm");
    if (!form) return;

    form.reset();
    ensureDatepicker();
    setDateField(new Date());

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

    await loadMeta();

    const form = document.getElementById("expenseForm");
    if (!form) return;
    form.reset();

    form.desc.value = tx.description || tx.desc || tx.note || "";
    form.amount.value = tx.amount;
    form.category_id.value = tx.category_id;

    if (form.payment_method_id) {
      form.payment_method_id.value =
        tx.payment_method_id ||
        tx.method_id ||
        (state.methods[0] && state.methods[0].id);
    }

    ensureDatepicker();
    setDateField(tx.date ? new Date(tx.date) : new Date());

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

    if (window.BudgetNotify?.refresh)
      window.BudgetNotify.refresh({ sync: true });
  }

  // ===== UI BIND =====
  function bindUI() {
    document.getElementById("addExpenseBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      openAdd();
    });

    const onActionClick = (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === "edit") openEdit(id);
      if (btn.dataset.action === "del") removeItem(id);
    };

    document.getElementById("txList")?.addEventListener("click", onActionClick);
    document
      .getElementById("monthlyAccordion")
      ?.addEventListener("click", onActionClick);

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
        submitBtn.disabled = true;

        try {
          if (state.editId) {
            const res = await API.update(state.editId, payload);
            if (!res?.success)
              throw new Error(res?.message || "Cập nhật thất bại");

            const idx = state.items.findIndex((t) => t.id === state.editId);
            if (idx !== -1) state.items[idx] = res.item;
          } else {
            const res = await API.create(payload);
            if (!res?.success)
              throw new Error(res?.message || "Tạo chi tiêu thất bại");

            state.items.unshift(res.item);
          }

          if (window.BudgetNotify?.refresh)
            window.BudgetNotify.refresh({ sync: true });

          buildFilterMenu();
          applyFilter();
          getExpenseModal().hide();

          form.reset();
          ensureDatepicker();
          setDateField(new Date());
          state.editId = null;
        } catch (err) {
          alert(err.message || "Có lỗi xảy ra");
        } finally {
          submitBtn.disabled = false;
        }
      });
    }

    document
      .getElementById("toggleGroupByMonth")
      ?.addEventListener("change", (e) => {
        state.groupByMonth = !!e.target.checked;
        renderList();
      });

    document
      .getElementById("btnExpandAll")
      ?.addEventListener("click", () => expandAllMonths());

    document
      .getElementById("btnCollapseAll")
      ?.addEventListener("click", () => collapseAllMonths());
  }

  // ===== INIT =====
  async function init(opts = {}) {
    ensureDatepicker();
    await loadMeta();

    const exp = await API.list({});
    state.items = (exp?.items || []).map((x) => ({ ...x, type: "expense" }));
    state.items.sort(
      (a, b) => (b.date || "").localeCompare(a.date || "") || b.id - a.id
    );

    bindUI();
    applyFilter();

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

    if (opts.autoOpen) openAdd();
  }

  return { init };
})();
