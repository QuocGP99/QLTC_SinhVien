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
    incomeCats: [], // meta danh mục thu nhập
    month: null, // YYYY-MM
    type: "", // '', 'expense', 'income'
    incomeCatId: "", // filter cho thu nhập
  };

  // ---- util ----
  const money = (n) =>
    (Number(n) || 0).toLocaleString("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    });
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  function parseISO(d) {
    try {
      return new Date(d);
    } catch {
      return null;
    }
  }
  function ymd(dateObj) {
    const p = (n) => String(n).padStart(2, "0");
    return `${dateObj.getFullYear()}-${p(dateObj.getMonth() + 1)}-${p(
      dateObj.getDate()
    )}`;
  }

  // Chuẩn hóa item từ 2 API về 1 shape
  function normalizeExpense(x) {
    return {
      id: x.id,
      type: "expense",
      amount: Number(x.amount), // âm/ dương để tính net: để dương ở đây, khi hiển thị list sẽ thêm dấu '-'
      date: x.date, // "YYYY-MM-DD"
      category_id: x.category_id,
      category: x.category || x.category_name || "",
      method: x.method || null,
      note: x.desc || x.note || "",
    };
  }
  function normalizeIncome(x) {
    return {
      id: x.id,
      type: "income",
      amount: Number(x.amount),
      date: x.received_at || x.date, // "YYYY-MM-DD"
      category_id: x.category_id,
      category: x.category || x.category_name || "",
      method: null,
      note: x.note || "",
    };
  }

  // ---- render list ----
  function renderList() {
    const wrap = document.getElementById("txList");
    wrap.innerHTML = "";
    if (!state.filtered.length) {
      wrap.innerHTML = `<div class="text-muted">Chưa có giao dịch.</div>`;
      return;
    }
    // sort by date desc, then id desc
    const items = state.filtered
      .slice()
      .sort(
        (a, b) => (b.date || "").localeCompare(a.date || "") || b.id - a.id
      );
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
      const el = document.createElement("div");
      el.className = "tx-card";
      el.innerHTML = `
        <div class="card-body d-flex align-items-start justify-content-between">
          <div class="me-3">
            <div class="fw-semibold">${icon}${esc(tx.note)}</div>
            <div class="small text-muted">${dateStr}${method}</div>
          </div>
          <div class="d-flex align-items-center gap-3">
            <span class="badge badge-soft" title="Danh mục">${esc(
              tx.category
            )}</span>
            ${amtHtml}
          </div>
        </div>
      `;
      wrap.appendChild(el);
    });
  }

  // ---- calendar ----
  function buildCalendar() {
    const cal = document.getElementById("calendar");
    const label = document.getElementById("calMonthLabel");
    cal.innerHTML = "";

    // Lấy tháng đang filter hoặc tháng hiện tại
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
      month = Number(mStr); // 1-12
    label.textContent = `Tháng ${month}/${year}`;

    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0); // ngày cuối tháng
    // offset: muốn thứ 2 là cột đầu → JS: 0=CN → map về 1..7 với CN=7
    const offset = (first.getDay() || 7) - 1; // 0..6 (T2->0 ... CN->6)

    // Tính tổng theo ngày
    const byDay = {}; // ymd -> {exp, inc, net}
    const inMonth = state.filtered.filter((tx) => {
      return tx.date && tx.date.startsWith(mVal);
    });
    inMonth.forEach((tx) => {
      const key = tx.date;
      byDay[key] = byDay[key] || { exp: 0, inc: 0, net: 0 };
      if (tx.type === "expense") {
        byDay[key].exp += tx.amount;
        byDay[key].net -= tx.amount;
      } else {
        byDay[key].inc += tx.amount;
        byDay[key].net += tx.amount;
      }
    });

    // Render cells
    // add empty cells for offset
    for (let i = 0; i < offset; i++) {
      const empty = document.createElement("div");
      empty.className = "cell";
      empty.style.visibility = "hidden";
      cal.appendChild(empty);
    }
    for (let d = 1; d <= last.getDate(); d++) {
      const DOM = document.createElement("div");
      DOM.className = "cell";
      const today = new Date(year, month - 1, d);
      const key = ymd(today);
      const agg = byDay[key] || { exp: 0, inc: 0, net: 0 };
      DOM.innerHTML = `
        <div class="d">${d}</div>
        <div class="sum exp small">- ${money(agg.exp)}</div>
        <div class="sum inc small">+ ${money(agg.inc)}</div>
        <div class="sum net small ${agg.net >= 0 ? "pos" : "neg"}">${
        agg.net >= 0 ? "+" : "-"
      } ${money(Math.abs(agg.net))}</div>
      `;
      cal.appendChild(DOM);
    }
  }

  // ---- filters ----
  function applyFilters() {
    const month = state.month; // YYYY-MM or null
    const type = state.type; // '', 'expense', 'income'
    const incCat = state.incomeCatId || ""; // category id for incomes

    let list = state.all.slice();

    if (type) list = list.filter((x) => x.type === type);

    if (month) list = list.filter((x) => x.date && x.date.startsWith(month));

    if (incCat) {
      // chỉ lọc theo danh mục thu nhập khi type==income hoặc all
      list = list.filter((x) =>
        x.type !== "income" ? true : String(x.category_id) === String(incCat)
      );
    }

    state.filtered = list;
    buildCalendar();
    renderList();
  }

  function bindFilters() {
    const m = document.getElementById("filterMonth");
    const t = document.getElementById("filterType");
    const c = document.getElementById("filterIncomeCat");
    const r = document.getElementById("btnReset");

    // set default month = tháng hiện tại
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

  // ---- init ----
  async function init() {
    bindFilters();
    await loadIncomeMeta();

    // lấy dữ liệu từ cả 2 API
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
      // Chờ API load xong (ví dụ sau 300ms) rồi scroll
      setTimeout(() => {
        const el = document.getElementById("recentSection");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 400);
    }
  });

  return { init };
})();
