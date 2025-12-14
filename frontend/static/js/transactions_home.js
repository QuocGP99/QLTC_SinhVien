// Trang tổng hợp giao dịch: recent list + calendar + filters
const TransactionsHome = (() => {
  const API_BASE = window.BASE_API_URL || "";
  const token = () => localStorage.getItem("access_token") || "";

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

  const API = {
    expenses: (p = {}) => apiGet("/api/expenses", p),
    incomes: (p = {}) => apiGet("/api/incomes", p),
    incomeMeta: () => apiGet("/api/incomes/meta"),
  };

  // ---- state ----
  let state = {
    all: [], // tất cả giao dịch (đã hợp nhất)
    filtered: [], // sau bộ lọc
    incomeCats: [],
    expenseCats: [],
    month: null, // YYYY-MM
    type: "", // '', 'expense', 'income'
    incomeCatId: "",
    expenseCatId: "",
  };

  // ---- util ----
  const money = (n) =>
    (Number(n) || 0).toLocaleString("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    });
  // Helper: Ánh xạ tên danh mục sang class CSS trong app.css
  const getCategoryClass = (name) => {
    if (!name) return "cat--khac";
    const n = name.toLowerCase().trim();

    // Nhóm Chi tiêu
    if (n.includes("ăn uống")) return "cat--an-uong";
    if (n.includes("di chuyển")) return "cat--di-chuyen";
    if (n.includes("giải trí")) return "cat--giai-tri";
    if (n.includes("học tập")) return "cat--hoc-tap";
    if (n.includes("nhà ở")) return "cat--nha-o";
    if (n.includes("mua sắm")) return "cat--mua-sam";
    if (n.includes("sức khỏe")) return "cat--suc-khoe";

    // Nhóm Thu nhập
    if (n.includes("lương")) return "cat--luong";
    if (n.includes("thưởng")) return "cat--thuong";
    if (n.includes("học bổng")) return "cat--hoc-bong";

    return "cat--khac"; // Mặc định
  };
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const ymd = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  const dmyVN = (iso) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  };

  // Chuẩn hoá
  const normalizeExpense = (x) => ({
    id: x.id,
    type: "expense",
    amount: Number(x.amount),
    date: x.date,
    category_id: x.category_id,
    category: x.category || x.category_name || "",
    method: x.method || null,
    note: x.desc || x.note || "",
  });
  const normalizeIncome = (x) => ({
    id: x.id,
    type: "income",
    amount: Number(x.amount),
    date: x.received_at || x.date,
    category_id: x.category_id,
    category: x.category || x.category_name || "",
    method: null,
    note: x.note || "",
  });
  // ---- render list ----
  function renderList() {
    const wrap = document.getElementById("txList");
    wrap.innerHTML = "";
    if (!state.filtered.length) {
      wrap.innerHTML = `<div class="text-muted">Chưa có giao dịch.</div>`;
      return;
    }
    const items = state.filtered
      .slice()
      .sort(
        (a, b) => (b.date || "").localeCompare(a.date || "") || b.id - a.id
      );

    // --- KHỐI HELPER MỚI THÊM ---
    const getCategoryClass = (name) => {
      if (!name) return "cat--khac";
      const n = name.toLowerCase().trim();
      if (n.includes("ăn uống")) return "cat--an-uong";
      if (n.includes("di chuyển")) return "cat--di-chuyen";
      if (n.includes("giải trí")) return "cat--giai-tri";
      if (n.includes("học tập")) return "cat--hoc-tap";
      if (n.includes("nhà ở")) return "cat--nha-o";
      if (n.includes("mua sắm")) return "cat--mua-sam";
      if (n.includes("sức khỏe")) return "cat--suc-khoe";
      if (n.includes("lương")) return "cat--luong";
      if (n.includes("thưởng")) return "cat--thuong";
      if (n.includes("học bổng")) return "cat--hoc-bong";
      return "cat--khac";
    };
    // ----------------------------

    items.forEach((tx) => {
      const dateStr = tx.date
        ? new Date(tx.date).toLocaleDateString("vi-VN")
        : "";
      const isExp = tx.type === "expense";
      const amtHtml = isExp
        ? `<span class="amount-exp">-${money(tx.amount)}</span>`
        : `<span class="amount-inc">+${money(tx.amount)}</span>`;
      const icon = isExp
        ? `<i class="bi bi-cash-stack text-danger me-1"></i>`
        : `<i class="bi bi-wallet2 text-success me-1"></i>`;
      const method = isExp ? ` · ${esc(tx.method || "Tiền mặt")}` : "";

      // Lấy class màu sắc tương ứng
      const catClass = getCategoryClass(tx.category);

      const el = document.createElement("div");
      el.className = "tx-card";
      el.innerHTML = `
        <div class="card-body d-flex align-items-start justify-content-between">
          <div class="me-3">
            <div class="fw-semibold">${icon}${esc(tx.note)}</div>
            <div class="small text-muted">${dateStr}${method}</div>
          </div>
          <div class="d-flex align-items-center gap-3">
            <span class="cat-chip ${catClass} sm" title="Danh mục">${esc(
        tx.category
      )}</span>
            ${amtHtml}
          </div>
        </div>`;
      wrap.appendChild(el);
    });
  }

  // ---- chi tiết ngày (modal) ----
  function openDayDetail(dateKey) {
    const items = state.all
      .filter((x) => x.date && x.date.startsWith(dateKey))
      .sort(
        (a, b) =>
          (b.type === a.type ? 0 : a.type === "expense" ? 1 : -1) ||
          b.amount - a.amount
      );

    const title = document.getElementById("dayDetailTitle");
    const body = document.getElementById("dayDetailBody");
    if (title) title.textContent = `Chi tiết giao dịch ngày ${dmyVN(dateKey)}`;

    if (!items.length) {
      body.innerHTML = `<div class="text-muted">Không có giao dịch.</div>`;
    } else {
      const totalExp = items
        .filter((i) => i.type === "expense")
        .reduce((s, i) => s + i.amount, 0);
      const totalInc = items
        .filter((i) => i.type === "income")
        .reduce((s, i) => s + i.amount, 0);

      body.innerHTML = `
        <div class="d-flex justify-content-between mb-2">
          <span class="text-danger">Tổng chi: <strong>${money(
            totalExp
          )}</strong></span>
          <span class="text-success">Tổng thu: <strong>${money(
            totalInc
          )}</strong></span>
        </div>
        <div class="list-group">
          ${items
            .map((tx) => {
              const isExp = tx.type === "expense";
              const sign = isExp ? "−" : "+";
              const amtCl = isExp ? "text-danger" : "text-success";
              const method = isExp ? ` · ${esc(tx.method || "Tiền mặt")}` : "";
              return `
              <div class="list-group-item d-flex justify-content-between align-items-start">
                <div class="me-3">
                  <div class="fw-semibold">${esc(
                    tx.note || "(không mô tả)"
                  )}</div>
                  <div class="small text-muted">${esc(
                    tx.category
                  )}${method}</div>
                </div>
                <div class="fw-semibold ${amtCl}">${sign}${money(
                tx.amount
              )}</div>
              </div>`;
            })
            .join("")}
        </div>`;
    }
    bootstrap.Modal.getOrCreateInstance(
      document.getElementById("dayDetailModal")
    ).show();
  }

  // ---- calendar (2 dòng + nút 3 chấm) ----
  function buildCalendar() {
    const cal = document.getElementById("calendar");
    const label = document.getElementById("calMonthLabel");
    cal.innerHTML = "";

    const mVal =
      state.month ||
      (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
      })();
    const [yStr, mStr] = mVal.split("-");
    const year = Number(yStr),
      month = Number(mStr);
    label.textContent = `Tháng ${month}/${year}`;

    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const offset = (first.getDay() || 7) - 1; // 0..6 (T2..CN)

    // cộng dồn theo ngày
    const byDay = {}; // key -> {exp,inc}
    const inMonth = state.filtered.filter(
      (tx) => tx.date && tx.date.startsWith(mVal)
    );
    inMonth.forEach((tx) => {
      const key = tx.date;
      byDay[key] = byDay[key] || { exp: 0, inc: 0 };
      if (tx.type === "expense") byDay[key].exp += tx.amount;
      else byDay[key].inc += tx.amount;
    });

    // offset empty
    for (let i = 0; i < offset; i++) {
      const empty = document.createElement("div");
      empty.className = "cell";
      empty.style.visibility = "hidden";
      cal.appendChild(empty);
    }

    // cells
    for (let d = 1; d <= last.getDate(); d++) {
      const DOM = document.createElement("div");
      DOM.className = "cell";
      const today = new Date(year, month - 1, d);
      const key = ymd(today);
      const agg = byDay[key] || { exp: 0, inc: 0 };

      DOM.innerHTML = `
        <div class="d">${d}</div>
        <div class="sum exp small">- ${money(agg.exp)}</div>
        <div class="sum inc small">+ ${money(agg.inc)}</div>
        <button type="button" class="btn btn-link btn-sm more-btn" data-date="${key}" title="Xem chi tiết">
          <i class="bi bi-three-dots"></i>
        </button>
      `;
      cal.appendChild(DOM);
    }

    // delegate click 3 chấm
    cal.onclick = (e) => {
      const btn = e.target.closest(".more-btn");
      if (!btn) return;
      const dateKey = btn.getAttribute("data-date");
      openDayDetail(dateKey);
    };
  }

  // ---- filters ----
  function applyFilters() {
    const month = state.month,
      type = state.type,
      incCat = state.incomeCatId || "";
    expCat = state.expenseCatId || "";
    let list = state.all.slice();
    if (type) list = list.filter((x) => x.type === type);
    if (month) list = list.filter((x) => x.date && x.date.startsWith(month));
    if (incCat)
      list = list.filter((x) =>
        x.type !== "income" ? true : String(x.category_id) === String(incCat)
      );
    if (expCat)
      list = list.filter((x) =>
        x.type !== "expense" ? true : String(x.category_id) === String(expCat)
      );
    state.filtered = list;
    buildCalendar();
    renderList();
  }

  function bindFilters() {
    const m = document.getElementById("filterMonth");
    const t = document.getElementById("filterType");
    const c = document.getElementById("filterIncomeCat");
    const cExp = document.getElementById("filterExpenseCat");
    const r = document.getElementById("btnReset");

    const now = new Date();
    m.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    state.month = m.value;

    m.onchange = () => {
      state.month = m.value || null;
      applyFilters();
    };
    t.onchange = () => {
      state.type = t.value || "";
      applyFilters();
    };
    c.onchange = () => {
      state.incomeCatId = c.value || "";
      applyFilters();
    };
    cExp.onchange = () => {
      state.expenseCatId = cExp.value || "";
      applyFilters();
    };
    r.onclick = () => {
      m.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      t.value = "";
      c.value = "";
      state.month = m.value;
      state.type = "";
      state.incomeCatId = "";
      state.expenseCatId = "";
      applyFilters();
    };
  }

  async function loadIncomeMeta() {
    try {
      const meta = await API.incomeMeta();
      state.incomeCats = meta?.categories || [];
      const sel = document.getElementById("filterIncomeCat");
      sel.innerHTML =
        `<option value="">Tất cả</option>` +
        state.incomeCats
          .map((x) => `<option value="${x.id}">${esc(x.name)}</option>`)
          .join("");
    } catch {}
  }

  async function loadExpensesMeta() {
    try {
      const meta = await API.expenseMeta();
      state.expenseCats = meta?.categories || [];
      const sel = document.getElementById("filterExpenseCat");
      sel.innerHTML =
        `<option value="">Tất cả</option>` +
        state.expenseCats
          .map((x) => `<option value="${x.id}">${esc(x.name)}</option>`)
          .join("");
    } catch {}
  }

  // ---- init ----
  async function init() {
    bindFilters();
    buildCalendar();
    await loadIncomeMeta();
    await loadExpensesMeta();

    const [exp, inc] = await Promise.allSettled([
      API.expenses({}),
      API.incomes({}),
    ]);
    const expenses =
      exp.status === "fulfilled"
        ? (exp.value?.items || []).map(normalizeExpense)
        : [];
    const incomes =
      inc.status === "fulfilled"
        ? (inc.value?.items || []).map(normalizeIncome)
        : [];

    state.all = expenses.concat(incomes);
    applyFilters();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const hash = window.location.hash;
    if (hash === "#recentSection") {
      setTimeout(() => {
        document
          .getElementById("recentSection")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 400);
    }
  });

  return { init };
})();
