// frontend/static/js/income.js
const IncomePage = (() => {
  let state = {
    categories: [],
    items: [],
    filtered: [],
    currentCategoryId: "",
    editId: null,
  };

  let dp = null,
    dateMode = "none";
  function toISODate(s) {
    if (!s) return "";
    if (s.includes("/")) {
      const [d, m, y] = s.split("/");
      return `${y}-${m}-${d}`;
    }
    return s;
  }
  function ensureDatepicker() {
    const el = document.getElementById("transactionDate");
    const btn = document.getElementById("btnOpenCalendar");
    if (!el) return;
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
    dateMode = "none";
    if (btn) btn.disabled = true;
  }
  function setDateField(d) {
    const el = document.getElementById("transactionDate");
    if (!el) return;
    const pad = (n) => String(n).padStart(2, "0");
    if (dateMode === "bootstrap") window.jQuery(el).datepicker("setDate", d);
    else if (dateMode === "vanilla") {
      ensureDatepicker();
      dp.setDate(d);
    } else
      el.value = `${pad(d.getDate())}/${pad(
        d.getMonth() + 1
      )}/${d.getFullYear()}`;
  }
  function getDateField() {
    const el = document.getElementById("transactionDate");
    if (!el) return "";
    if (dateMode === "bootstrap")
      return window.jQuery(el).datepicker("getFormattedDate", "dd/mm/yyyy");
    return el.value || "";
  }

  const API_BASE = window.BASE_API_URL || "";
  function token() {
    return localStorage.getItem("access_token") || "";
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
        headers: { Authorization: token() ? `Bearer ${token()}` : undefined },
      })
    );
  }
  async function apiPost(path, body) {
    return safeJson(
      await fetch(API_BASE + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token() ? `Bearer ${token()}` : undefined,
        },
        body: JSON.stringify(body),
      })
    );
  }
  async function apiPatch(path, body) {
    return safeJson(
      await fetch(API_BASE + path, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token() ? `Bearer ${token()}` : undefined,
        },
        body: JSON.stringify(body),
      })
    );
  }
  async function apiDelete(path) {
    return safeJson(
      await fetch(API_BASE + path, {
        method: "DELETE",
        headers: { Authorization: token() ? `Bearer ${token()}` : undefined },
      })
    );
  }

  const API = {
    list: (p = {}) => apiGet("/api/incomes", p),
    create: (b) => apiPost("/api/incomes", b),
    update: (id, b) => apiPatch(`/api/incomes/${id}`, b),
    remove: (id) => apiDelete(`/api/incomes/${id}`),
    meta: () => apiGet("/api/incomes/meta"),
  };

  const money = (n) =>
    (Number(n) || 0).toLocaleString("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    });
  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  function setKPIs(list) {
    const total = list.reduce((s, x) => s + Number(x.amount || 0), 0);
    const kpiTotal = document.getElementById("kpiTotal");
    const kpiCount = document.getElementById("kpiCount");
    const kpiAvg = document.getElementById("kpiAvg");
    if (kpiTotal) kpiTotal.textContent = money(total);
    if (kpiCount) kpiCount.textContent = list.length;
    if (kpiAvg) kpiAvg.textContent = money(total / (list.length || 1));
  }

  function renderList() {
    const wrap = document.getElementById("txList");
    wrap.innerHTML = "";
    if (!state.filtered.length) {
      wrap.innerHTML = `<div class="text-muted">Chưa có thu nhập.</div>`;
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
              tx.desc || tx.note || ""
            )}</div>
            <div class="small text-muted">${dateFormatted}</div>
          </div>
          <div class="d-flex align-items-center gap-3">
            <span class="badge badge-soft" data-cat-id="${tx.category_id}">
              ${escapeHtml(tx.category || tx.category_name || "")}
            </span>
            <div class="amount text-success">+${money(tx.amount)}</div>
            <div class="text-muted d-flex gap-2">
              <button class="btn btn-sm btn-link text-muted px-1" title="Sửa" data-action="edit" data-id="${
                tx.id
              }"><i class="bi bi-pencil-square"></i></button>
              <button class="btn btn-sm btn-link text-muted px-1" title="Xóa" data-action="del" data-id="${
                tx.id
              }"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>`;
      wrap.appendChild(el);
    });
  }

  async function loadMeta() {
    const data = await API.meta();
    state.categories = data?.categories || [];
    const selCat = document.getElementById("transactionCategory");
    if (selCat)
      selCat.innerHTML = state.categories
        .map((c) => `<option value="${c.id}">${c.name}</option>`)
        .join("");
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

  function modalEl() {
    return document.getElementById("transactionModal");
  }
  function getModal() {
    return bootstrap.Modal.getOrCreateInstance(modalEl());
  }

  function openAdd() {
    state.editId = null;
    const form = document.getElementById("transactionForm");
    form.reset();
    ensureDatepicker();
    setDateField(new Date());
    document.getElementById("categoryHint").textContent = "Nguồn thu nhập";
    document.getElementById("submitBtnText").textContent = "Lưu thu nhập";
    document.querySelector("#transactionModal .modal-title").textContent =
      "Thêm thu nhập";
    // Ẩn ô payment method nếu bạn dùng chung form.html
    const pm = document.getElementById("paymentMethod");
    if (pm) pm.closest(".mb-3").style.display = "none";
    getModal().show();
  }

  async function openEdit(id) {
    const tx = state.items.find((t) => String(t.id) === String(id));
    if (!tx) return;
    state.editId = tx.id;
    const form = document.getElementById("transactionForm");
    form.reset();
    await loadMeta();
    if (form.desc) form.desc.value = tx.desc || tx.note || "";
    if (form.amount) form.amount.value = tx.amount;
    if (form.category) form.category.value = tx.category_id;
    ensureDatepicker();
    setDateField(tx.date ? new Date(tx.date) : new Date());
    document.getElementById("categoryHint").textContent = "Nguồn thu nhập";
    document.getElementById("submitBtnText").textContent = "Lưu thu nhập";
    document.querySelector("#transactionModal .modal-title").textContent =
      "Cập nhật thu nhập";
    const pm = document.getElementById("paymentMethod");
    if (pm) pm.closest(".mb-3").style.display = "none";
    getModal().show();
  }

  async function removeItem(id) {
    if (!confirm("Xoá thu nhập này?")) return;
    const res = await API.remove(id);
    if (!res?.success) return alert(res?.message || "Xoá thất bại");
    state.items = state.items.filter((x) => x.id !== Number(id));
    buildFilterMenu();
    applyFilter();
  }

  function bindUI() {
    const btnAdd =
      document.getElementById("addIncomeBtn") ||
      document.querySelector('[data-bs-target="#transactionModal"]');
    if (btnAdd) {
      btnAdd.removeAttribute("data-bs-toggle");
      btnAdd.removeAttribute("data-bs-target");
      btnAdd.addEventListener("click", (e) => {
        e.preventDefault();
        openAdd();
      });
    }
    document.getElementById("txList").onclick = (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === "edit") openEdit(id);
      if (btn.dataset.action === "del") removeItem(id);
    };
    document.getElementById("transactionForm").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        amount: Number(fd.get("amount") || 0),
        category_id: Number(fd.get("category") || fd.get("category_id") || 0),
        note: (fd.get("note") || fd.get("desc") || "").trim(),
        date: toISODate(getDateField()),
      };
      if (payload.amount <= 0 || !payload.category_id)
        return alert("Vui lòng nhập số tiền > 0 và chọn danh mục.");

      const submitBtn = e.target.querySelector('button[type="submit"]');
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
            throw new Error(res?.message || "Tạo thu nhập thất bại");
          state.items.unshift(res.item);
        }
        buildFilterMenu();
        applyFilter();
        getModal().hide();
        e.target.reset();
        ensureDatepicker();
        setDateField(new Date());
        state.editId = null;
      } catch (err) {
        alert(err.message || "Có lỗi xảy ra");
      } finally {
        submitBtn.disabled = false;
      }
    };
  }

  async function init() {
    ensureDatepicker();
    await loadMeta();
    const inc = await API.list({});
    state.items = (inc?.items || []).map((x) => ({ ...x, type: "income" }));
    state.items.sort(
      (a, b) => (b.date || "").localeCompare(a.date || "") || b.id - a.id
    );
    bindUI();
    applyFilter();
  }

  return { init };
})();
