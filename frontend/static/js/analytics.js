// frontend/static/js/analytics.js
// Trang Analytics: lấy dữ liệu thật từ BE, render KPI, biểu đồ, bảng giao dịch

import { apiCall } from "./api.js";

/* ============================================================
 * 1. CONSTANTS & UTILS
 * ============================================================ */

// màu mặc định cho pie nếu không lấy được từ CSS category
const PIE_COLORS = [
  "#0ea5e9",
  "#f97316",
  "#22c55e",
  "#a855f7",
  "#e11d48",
  "#14b8a6",
  "#facc15",
];

function formatCurrency(n) {
  try {
    return Number(n || 0).toLocaleString("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  } catch {
    return `${n} ₫`;
  }
}

function formatDateVN(iso) {
  if (!iso) return "";
  if (typeof iso === "string" && iso.length >= 10) {
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

/* ============================================================
 * 2. RANGE / FILTER
 * ============================================================ */
function getTxFilters() {
  const from = document.getElementById("fromDate")?.value || "";
  const to = document.getElementById("toDate")?.value || "";
  const type = document.getElementById("filterType")?.value || "all"; // all|expense|income
  return { from, to, type };
}

function setDefaultRangeIfEmpty() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);

  const f = document.getElementById("fromDate");
  const t = document.getElementById("toDate");
  if (f && !f.value) f.value = toISO(from);
  if (t && !t.value) t.value = toISO(to);
}

function updateRangeLabel() {
  const lbl = document.getElementById("rangeLabel");
  if (!lbl) return;
  const { from, to } = getTxFilters();
  if (from && to)
    lbl.textContent = `${formatDateVN(from)} → ${formatDateVN(to)}`;
  else lbl.textContent = "";
}

/* ============================================================
 * 3. CHART HELPER
 * ============================================================ */
const CH = {};
function drawChart(canvasId, cfg) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (CH[canvasId]) CH[canvasId].destroy();
  CH[canvasId] = new Chart(el, cfg);
  return CH[canvasId];
}

/* ============================================================
 * 4. CATEGORY COLOR FROM CSS
 * ============================================================ */
const CAT_COLOR_CACHE = {};

function slugifyCategoryName(name = "") {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCategoryColorFromCSS(
  categoryName,
  fallbackColor = "rgba(201,203,207,0.6)"
) {
  if (!categoryName) return fallbackColor;

  const slug = slugifyCategoryName(categoryName);
  if (CAT_COLOR_CACHE[slug]) return CAT_COLOR_CACHE[slug];

  const span = document.createElement("span");
  span.className = `cat-chip cat--${slug}`;
  span.style.position = "absolute";
  span.style.visibility = "hidden";
  span.style.pointerEvents = "none";
  document.body.appendChild(span);

  const styles = getComputedStyle(span);
  let color = styles.getPropertyValue("--cat-fg").trim();
  if (!color) color = styles.color || fallbackColor;

  document.body.removeChild(span);
  CAT_COLOR_CACHE[slug] = color || fallbackColor;
  return CAT_COLOR_CACHE[slug];
}

/* ============================================================
 * 5. GLOBAL STATE
 * ============================================================ */
let lastTxRows = []; // để pie fallback
let analyticsSummary = null;

/* ============================================================
 * 6. BUILD BREAKDOWN FROM TX (FALLBACK PIE)
 * ============================================================ */
function buildExpenseBreakdownFromTx() {
  const map = {};
  lastTxRows
    .filter((r) => String(r.kind || "").toLowerCase() === "expense")
    .forEach((r) => {
      const cat = r.category || "Khác";
      const amt = Number(r.amount) || 0;
      map[cat] = (map[cat] || 0) + amt;
    });
  return Object.keys(map).map((catName) => ({
    category: catName,
    total: map[catName],
  }));
}

function buildIncomeBreakdownFromTx() {
  const map = {};
  lastTxRows
    .filter((r) => String(r.kind || "").toLowerCase() === "income")
    .forEach((r) => {
      const cat = r.category || "Khác";
      const amt = Number(r.amount) || 0;
      map[cat] = (map[cat] || 0) + amt;
    });
  return Object.keys(map).map((catName) => ({
    category: catName,
    total: map[catName],
  }));
}

/* ============================================================
 * 7. LOAD SUMMARY (KPI + chart line/bar)
 * ============================================================ */
async function loadAnalyticsSummary() {
  const { from, to, type } = getTxFilters();
  const qs = new URLSearchParams();

  // Lấy đúng preset từ dropdown
  const preset =
    document.getElementById("rangePreset")?.value || "current_month";
  qs.set("range", preset);

  // Nếu có from/to thì FE gửi → BE sẽ ưu tiên from/to hơn preset
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  // Bộ lọc loại giao dịch (all | income | expense)
  if (type && type !== "all") qs.set("type", type);

  try {
    analyticsSummary = await apiCall(
      `/api/analytics/summary?${qs.toString()}`,
      "GET"
    );
  } catch (err) {
    console.error("loadAnalyticsSummary error:", err);
    analyticsSummary = null;
  }

  updateKPI();
  renderChartsFromSummary();
  renderAIFromSummary();
}

function applyPresetRange() {
  const preset = document.getElementById("rangePreset")?.value;
  const f = document.getElementById("fromDate");
  const t = document.getElementById("toDate");
  const now = new Date();

  if (!preset) return;

  let from, to;
  to = now;

  if (preset === "current_month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (preset === "last_month") {
    const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthEnd = new Date(firstThis - 1);
    from = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
    to = lastMonthEnd;
  } else if (preset === "last_3_months") {
    from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  } else if (preset === "last_6_months") {
    from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  } else if (preset === "last_12_months") {
    from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  }

  f.value = toISO(from);
  t.value = toISO(to);
}

function updateKPI() {
  const kpiTrendVal = document.getElementById("kpiTrendVal");
  const kpiBudgetEff = document.getElementById("kpiBudgetEff");
  const kpiSaveRate = document.getElementById("kpiSaveRate");
  const kpiSaveBar = document.getElementById("kpiSaveBar");
  const kpiDaily = document.getElementById("kpiDaily");
  const kpiCount = document.getElementById("kpiCount");

  // nếu backend chưa trả kpi thì thôi
  const kpi = analyticsSummary?.kpi || {};

  // các giá trị backend trả đều là số thập phân 0..1 → phải *100 để hiển thị %
  const monthTrendPct = Number(kpi.month_trend_pct ?? 0); // vd: 0.12
  const budgetEff = Number(kpi.budget_efficiency ?? 0); // vd: 0.7
  const savingRate = Number(kpi.saving_rate ?? 0); // vd: 0.35
  const avgPerDay = Number(kpi.avg_per_day ?? 0); // tiền
  const txCount = Number(kpi.tx_count ?? 0); // số giao dịch

  // 1) Xu hướng chi tiêu
  if (kpiTrendVal) {
    const pct = (monthTrendPct * 100).toFixed(1);
    kpiTrendVal.textContent = `${pct}%`;
  }

  // 2) Hiệu quả ngân sách
  if (kpiBudgetEff) {
    const pct = (budgetEff * 100).toFixed(1);
    kpiBudgetEff.textContent = `${pct}%`;
  }

  // 3) Tỷ lệ tiết kiệm
  if (kpiSaveRate) {
    const pct = (savingRate * 100).toFixed(1);
    kpiSaveRate.textContent = `${pct}%`;
  }
  if (kpiSaveBar) {
    kpiSaveBar.style.width = `${savingRate * 100}%`;
  }

  // 4) Chi trung bình / ngày
  if (kpiDaily) {
    kpiDaily.textContent = formatCurrency(avgPerDay);
  }

  // 5) Số giao dịch
  if (kpiCount) {
    kpiCount.textContent = txCount;
  }
}

function renderChartsFromSummary() {
  if (!analyticsSummary) return;

  // daily expense
  const dailyArr = Array.isArray(analyticsSummary.daily_expense)
    ? analyticsSummary.daily_expense.slice()
    : [];
  dailyArr.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  drawChart("lineDaily", {
    type: "line",
    data: {
      labels: dailyArr.map((d) => formatDateVN(d.date)),
      datasets: [
        {
          label: "Chi tiêu (₫)",
          data: dailyArr.map((d) => Number(d.total || 0)),
          fill: false,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Chi tiêu: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
    },
  });

  // monthly bar
  const monthArr = Array.isArray(analyticsSummary.monthly_expense)
    ? analyticsSummary.monthly_expense
    : [];
  drawChart("barMonthly", {
    type: "bar",
    data: {
      labels: monthArr.map((m) => m.month || ""),
      datasets: [
        {
          label: "Chi tiêu theo tháng (₫)",
          data: monthArr.map((m) => Number(m.total || 0)),
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `Tháng ${ctx.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
    },
  });
}

function renderAIFromSummary() {
  if (!analyticsSummary) return;
  const ai = analyticsSummary.ai || {};
  const scoreEl = document.getElementById("aiScore");
  const barEl = document.getElementById("aiScoreBar");
  const tipsEl = document.getElementById("aiTips");

  const scoreVal = Number(ai.score || 0);
  if (scoreEl) scoreEl.textContent = scoreVal.toFixed(1);
  if (barEl) barEl.style.width = `${scoreVal * 10}%`;

  if (tipsEl) {
    if (Array.isArray(ai.tips) && ai.tips.length) {
      tipsEl.innerHTML = ai.tips
        .map((t) => `<li class="list-group-item">💡 ${escapeHtml(t)}</li>`)
        .join("");
    } else {
      tipsEl.innerHTML = `<li class="list-group-item text-muted">Không có gợi ý</li>`;
    }
  }
}

/* ============================================================
 * 8. LOAD TRANSACTIONS (TABLE)
 * ============================================================ */

// lọc theo from/to ở client để phòng trường hợp BE chưa làm filter
function clientFilterByDate(items, from, to) {
  if (!from && !to) return items;
  const f = from ? new Date(from) : null;
  const t = to ? new Date(to) : null;
  return items.filter((it) => {
    const d = new Date(it.date);
    if (f && d < f) return false;
    if (t && d > t) return false;
    return true;
  });
}

async function loadTransactions() {
  const tbody = document.getElementById("txTable");
  if (!tbody) return;

  const { from, to, type } = getTxFilters();
  tbody.innerHTML = `<tr><td colspan="5" class="text-center">Đang tải...</td></tr>`;

  let rows = [];

  // 1. THỬ gọi các route analytics trước
  try {
    if (type === "expense") {
      const res = await apiCall(
        `/api/analytics/transactions/expenses?${
          from || to ? `from=${from}&to=${to}` : ""
        }`,
        "GET"
      );
      const arr = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.data)
        ? res.data
        : [];
      rows = normalizeRows(arr, "expense");
    } else if (type === "income") {
      const res = await apiCall(
        `/api/analytics/transactions/incomes?${
          from || to ? `from=${from}&to=${to}` : ""
        }`,
        "GET"
      );
      const arr = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.data)
        ? res.data
        : [];
      rows = normalizeRows(arr, "income");
    } else {
      const res = await apiCall(
        `/api/analytics/transactions${
          from || to ? `?from=${from}&to=${to}` : ""
        }`,
        "GET"
      );
      const arr = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.transactions)
        ? res.transactions
        : [];
      rows = normalizeUnion(arr);
    }
  } catch (err) {
    // bỏ qua, sẽ fallback xuống dưới
    console.warn("analytics transactions not available, fallback...", err);
  }

  // 2. Nếu vẫn rỗng → fallback sang /api/expenses và /api/incomes giống trang giao dịch
  if (!rows.length) {
    try {
      const expRes = await apiCall(`/api/expenses`, "GET");
      const expArr = Array.isArray(expRes?.items) ? expRes.items : [];
      const normExp = normalizeRows(expArr, "expense");

      let incArr = [];
      try {
        const incRes = await apiCall(`/api/incomes`, "GET");
        incArr = Array.isArray(incRes?.items) ? incRes.items : [];
      } catch (e2) {
        incArr = [];
      }
      const normInc = normalizeRows(incArr, "income");

      rows = [...normExp, ...normInc];

      // client filter theo from/to
      if (from || to) {
        rows = clientFilterByDate(rows, from, to);
      }
    } catch (e) {
      console.error("fallback /api/expenses + /api/incomes error:", e);
      rows = [];
    }
  }

  // sort mới nhất trước
  rows.sort((a, b) => new Date(b.date) - new Date(a.date));

  // cache cho pie fallback
  lastTxRows = rows.slice();

  renderTransactions(rows);
  updateRangeLabel();
}

function normalizeRows(raw, kind) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      let date =
        r.date ||
        r.spent_at ||
        r.spentAt ||
        r.received_at ||
        r.transaction_date ||
        r.tx_date ||
        r.createdAt ||
        null;

      if (!date && r.created_at) {
        date = String(r.created_at).slice(0, 10);
      }

      const desc =
        r.desc ||
        r.description ||
        r.note ||
        r.source ||
        r.title ||
        (kind === "income" ? "Thu nhập" : "Chi tiêu");

      const category =
        r.category ||
        r.category_name ||
        r.categoryName ||
        (kind === "income" ? "Thu nhập khác" : "Khác");

      const method =
        r.method ||
        r.method_name ||
        r.payment_method ||
        r.payment_method_name ||
        r.wallet ||
        "";

      const amount = Number(r.amount ?? r.total ?? r.expense ?? r.income ?? 0);

      return { date, desc, category, method, amount, kind };
    })
    .filter((x) => !!x.date);
}

function normalizeUnion(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const k = String(r.kind || r.type || r.tx_type || "").toLowerCase();
      const kind = k === "income" ? "income" : "expense";

      let date =
        r.date ||
        r.spent_at ||
        r.spentAt ||
        r.received_at ||
        r.transaction_date ||
        r.tx_date ||
        r.createdAt ||
        null;
      if (!date && r.created_at) {
        date = String(r.created_at).slice(0, 10);
      }

      const desc =
        r.desc ||
        r.description ||
        r.note ||
        r.source ||
        r.title ||
        (kind === "income" ? "Thu nhập" : "Chi tiêu");

      const category =
        r.category ||
        r.category_name ||
        r.categoryName ||
        (kind === "income" ? "Thu nhập" : "Khác");

      const method =
        r.method ||
        r.method_name ||
        r.payment_method ||
        r.payment_method_name ||
        r.wallet ||
        "";

      const amount = Number(r.amount ?? r.total ?? r.expense ?? r.income ?? 0);

      return { date, desc, category, method, amount, kind };
    })
    .filter((x) => !!x.date);
}

function renderTransactions(rows) {
  const tbody = document.getElementById("txTable");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Không có giao dịch nào</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((r) => {
      const kind = String(r.kind || "").toLowerCase();
      const isIncome = kind === "income";
      const sign = isIncome ? "+" : "−";
      const cls = isIncome ? "text-success" : "text-danger";
      return `
        <tr>
          <td>${formatDateVN(r.date)}</td>
          <td>${escapeHtml(r.desc || "-")}</td>
          <td>${escapeHtml(r.category || "")}</td>
          <td>${escapeHtml(r.method || "")}</td>
          <td class="text-end ${cls} fw-semibold">
            ${sign}${formatCurrency(r.amount)}
          </td>
        </tr>
      `;
    })
    .join("");
}

/* ============================================================
 * 9. PIE CHARTS (Expense / Income)
 * ============================================================ */
function renderLegend(listEl, labels, values, colors) {
  if (!listEl) return;
  const sum = values.reduce((s, x) => s + x, 0) || 1;

  listEl.innerHTML = labels
    .map((label, idx) => {
      const val = values[idx] || 0;
      const pct = ((val / sum) * 100).toFixed(1);
      const color = colors[idx];
      return `
        <li class="d-flex justify-content-between align-items-start mb-2">
          <div class="d-flex align-items-start">
            <span class="d-inline-block rounded-circle me-2 flex-shrink-0" style="width:10px;height:10px;background:${color};"></span>
            <div>${escapeHtml(label)}</div>
          </div>
          <div class="text-end ms-2">
            <div class="fw-semibold">${formatCurrency(val)}</div>
            <div class="text-muted">(${pct}%)</div>
          </div>
        </li>
      `;
    })
    .join("");
}

function renderPieExpense(summary) {
  const wrapper = document.getElementById("cardPieExpense");
  const legendEl = document.getElementById("pieExpenseLegend");
  if (!wrapper) return;

  let catArr = Array.isArray(summary?.expense_by_category)
    ? summary.expense_by_category
    : [];

  if (!catArr.length) {
    catArr = buildExpenseBreakdownFromTx();
  }

  let labels = catArr.map((it) => it.category || "Khác");
  let values = catArr.map((it) => Number(it.total || 0));

  if (!labels.length) {
    wrapper.style.display = "";
    drawChart("pieExpense", {
      type: "pie",
      data: {
        labels: ["Không có dữ liệu"],
        datasets: [
          {
            data: [1],
            backgroundColor: ["rgba(200,200,200,0.5)"],
          },
        ],
      },
      options: { plugins: { legend: { display: false } } },
    });
    if (legendEl)
      legendEl.innerHTML = `<li class="text-muted">Không có dữ liệu</li>`;
    return;
  }

  const colors = labels.map((label, i) =>
    getCategoryColorFromCSS(label, PIE_COLORS[i % PIE_COLORS.length])
  );

  drawChart("pieExpense", {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const label = labels[idx] || "";
              const val = values[idx] || 0;
              const sum = values.reduce((s, x) => s + x, 0) || 1;
              const pct = ((val / sum) * 100).toFixed(1) + "%";
              return `${label}: ${formatCurrency(val)} (${pct})`;
            },
          },
        },
      },
    },
  });

  renderLegend(legendEl, labels, values, colors);
}

function renderPieIncome(summary) {
  const wrapper = document.getElementById("cardPieIncome");
  const legendEl = document.getElementById("pieIncomeLegend");
  if (!wrapper) return;

  let catArr = Array.isArray(summary?.income_by_category)
    ? summary.income_by_category
    : [];

  if (!catArr.length) {
    catArr = buildIncomeBreakdownFromTx();
  }

  let labels = catArr.map((it) => it.category || "Khác");
  let values = catArr.map((it) => Number(it.total || 0));

  if (!labels.length) {
    wrapper.style.display = "";
    drawChart("pieIncome", {
      type: "pie",
      data: {
        labels: ["Không có dữ liệu"],
        datasets: [
          {
            data: [1],
            backgroundColor: ["rgba(200,200,200,0.4)"],
          },
        ],
      },
      options: { plugins: { legend: { display: false } } },
    });
    if (legendEl)
      legendEl.innerHTML = `<li class="text-muted">Không có dữ liệu</li>`;
    return;
  }

  const colors = labels.map((lbl, i) =>
    getCategoryColorFromCSS(lbl, PIE_COLORS[i % PIE_COLORS.length])
  );

  drawChart("pieIncome", {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const label = labels[idx] || "";
              const val = values[idx] || 0;
              const sum = values.reduce((s, x) => s + x, 0) || 1;
              const pct = ((val / sum) * 100).toFixed(1) + "%";
              return `${label}: ${formatCurrency(val)} (${pct})`;
            },
          },
        },
      },
    },
  });

  renderLegend(legendEl, labels, values, colors);
}

function refreshPieCharts() {
  renderPieExpense(analyticsSummary || {});
  renderPieIncome(analyticsSummary || {});
}

/* ============================================================
 * 10. BUDGET COMPARISON
 * ============================================================ */
async function renderBudgetComparison() {
  const { from, to } = getTxFilters();
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  try {
    const data = await apiCall(
      `/api/analytics/budget_comparison?${qs.toString()}`,
      "GET"
    );
    const arr = Array.isArray(data?.items) ? data.items : [];

    // đảm bảo luôn có ít nhất 1 dòng để chart không lỗi
    if (!arr.length) {
      drawChart("barBudget", {
        type: "bar",
        data: {
          labels: ["Không có dữ liệu"],
          datasets: [
            { label: "Chi tiêu", data: [0] },
            { label: "Ngân sách", data: [0] },
          ],
        },
        options: { plugins: { legend: { position: "bottom" } } },
      });
      return;
    }

    const labels = arr.map((x) => x.category);
    const spentVals = arr.map((x) => Number(x.expense || 0));
    const budgetVals = arr.map((x) => Number(x.budget || 0));

    drawChart("barBudget", {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Chi tiêu", data: spentVals },
          { label: "Ngân sách", data: budgetVals },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => formatCurrency(v) },
          },
        },
      },
    });
  } catch (err) {
    // nếu còn lỗi thì vẽ khung trống
    drawChart("barBudget", {
      type: "bar",
      data: {
        labels: ["Không có dữ liệu"],
        datasets: [
          { label: "Chi tiêu", data: [0] },
          { label: "Ngân sách", data: [0] },
        ],
      },
      options: { plugins: { legend: { position: "bottom" } } },
    });
  }
}

/* ============================================================
 * 11. EVENTS
 * ============================================================ */
function wireEvents() {
  const btnApply = document.getElementById("btnApply");
  const presetSel = document.getElementById("rangePreset");

  presetSel?.addEventListener("change", () => {
    applyPresetRange();
  });

  const typeSel = document.getElementById("filterType");

  const onApply = async () => {
    await loadTransactions();
    await loadAnalyticsSummary();
    refreshPieCharts();
    await renderBudgetComparison();
  };

  if (btnApply) btnApply.addEventListener("click", onApply);
  if (typeSel) typeSel.addEventListener("change", onApply);
}

// ============================================================
// THEO DÕI MỤC TIÊU TIẾT KIỆM (đúng với index.html: <canvas id="savingsTrend">)
// ============================================================
async function renderSavingsFromAPI() {
  // đúng id trong index.html
  const canvasId = "savingsTrend";
  const el = document.getElementById(canvasId);
  if (!el) return;

  try {
    // 1) thử lấy từ analytics trước (format chuẩn)
    let data = await apiCall("/api/analytics/savings_progress", "GET");

    // 2) nếu chưa có route mới -> fallback về /api/savings cũ
    if (!data || (!Array.isArray(data?.items) && !Array.isArray(data))) {
      data = await apiCall("/api/savings", "GET");
    }

    // 3) chuẩn hoá mảng
    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
      ? data
      : [];

    if (!items.length) {
      // vẽ chart trống để giao diện không trắng
      drawChart(canvasId, {
        type: "bar",
        data: {
          labels: ["Không có dữ liệu"],
          datasets: [
            { label: "Đã tiết kiệm", data: [0] },
            { label: "Mục tiêu", data: [0] },
          ],
        },
        options: { plugins: { legend: { position: "bottom" } } },
      });
      return;
    }

    // 4) lấy đúng field - vì BE có thể đặt khác
    const labels = items.map((g) => g.name || g.title || `Mục tiêu #${g.id}`);
    const currents = items.map((g) =>
      Number(g.current_amount || g.current || g.saved_amount || 0)
    );
    const targets = items.map((g) =>
      Number(g.target_amount || g.goal_amount || g.target || 0)
    );

    // 5) vẽ 2 cột: đã tiết kiệm vs mục tiêu
    drawChart(canvasId, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Đã tiết kiệm",
            data: currents,
          },
          {
            label: "Mục tiêu",
            data: targets,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y || 0)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => formatCurrency(v),
            },
          },
        },
      },
    });
  } catch (err) {
    console.error("renderSavingsFromAPI error:", err);
    // fallback vẽ chart rỗng
    drawChart("savingsTrend", {
      type: "bar",
      data: {
        labels: ["Không có dữ liệu"],
        datasets: [
          { label: "Đã tiết kiệm", data: [0] },
          { label: "Mục tiêu", data: [0] },
        ],
      },
      options: { plugins: { legend: { position: "bottom" } } },
    });
  }
}

/* ============================================================
 * 12. INIT
 * ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  setDefaultRangeIfEmpty();
  wireEvents();

  await loadTransactions(); // để bảng chắc chắn có
  await loadAnalyticsSummary(); // để KPI chắc chắn có
  refreshPieCharts();
  await renderBudgetComparison();
  await renderSavingsFromAPI();
  await loadExpenseForecast();
});

// =========================
// EXPORT CSV (UTF-16LE cho Excel)
// =========================
document.getElementById("exportCsv")?.addEventListener("click", () => {
  if (!lastTxRows.length) {
    alert("Không có dữ liệu để xuất CSV");
    return;
  }

  const header = [
    "Ngày",
    "Mô tả",
    "Danh mục",
    "Phương thức",
    "Loại",
    "Số tiền",
  ];
  const rows = lastTxRows.map((r) => [
    r.date,
    r.desc,
    r.category,
    r.method,
    r.kind,
    r.amount,
  ]);

  const csv = [header, ...rows]
    .map((row) =>
      row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  // ---- Encode UTF-16LE (Excel đọc tiếng Việt chuẩn) ----
  function toUTF16LE(str) {
    const buf = new ArrayBuffer(str.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < str.length; i++) {
      view.setUint16(i * 2, str.charCodeAt(i), true); // little-endian
    }
    return new Uint8Array(buf);
  }

  const BOM = new Uint8Array([0xff, 0xfe]); // BOM UTF-16LE
  const utf16Content = toUTF16LE(csv);

  const blob = new Blob([BOM, utf16Content], {
    type: "text/csv;charset=utf-16le;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "analytics_transactions.csv";
  a.click();
  URL.revokeObjectURL(url);
});

// =========================
// PRINT PAGE
// =========================
document.getElementById("printPdf")?.addEventListener("click", () => {
  window.print();
});

// =========================
// DOWNLOAD ALL CHARTS AS PNG
// =========================
document.getElementById("saveCharts")?.addEventListener("click", () => {
  const keys = Object.keys(CH);
  if (!keys.length) {
    alert("Không có biểu đồ để tải xuống");
    return;
  }

  keys.forEach((id, index) => {
    const chart = CH[id];
    try {
      const url = chart.toBase64Image();
      const a = document.createElement("a");
      a.href = url;
      a.download = `chart_${id}.png`;
      a.click();
    } catch (e) {
      console.error("Không thể xuất chart:", id, e);
    }
  });
});

async function loadExpenseForecast() {
  const data = await apiCall("/api/analytics/forecast/expenses", "GET");
  if (!data || data.error) return;

  const history = data.history || [];
  const future = data.forecast || [];

  const labels = [...history.map((p) => p.ds), ...future.map((p) => p.ds)];

  const valuesHistory = history.map((p) => p.value);
  const valuesForecast = future.map((p) => p.value);

  drawChart("expenseForecastChart", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Chi tiêu lịch sử",
          data: [...valuesHistory, ...Array(valuesForecast.length).fill(null)],
          borderWidth: 2,
        },
        {
          label: "Dự báo 30 ngày tới",
          data: [...Array(valuesHistory.length).fill(null), ...valuesForecast],
          borderDash: [6, 4],
          borderWidth: 2,
        },
      ],
    },
  });

  const totalEl = document.getElementById("kpiForecastTotal");
  const changeEl = document.getElementById("kpiForecastChange");
  const labelEl = document.getElementById("kpiForecastLabel");

  if (totalEl) {
    totalEl.innerText = data.total_forecast.toLocaleString("vi-VN") + " đ";
  }

  if (changeEl && data.change_pct !== null) {
    const sign = data.change_pct > 0 ? "+" : "";
    changeEl.innerText = `${sign}${data.change_pct.toFixed(1)}%`;
  }

  if (labelEl && data.change_pct !== null) {
    if (data.change_pct > 5) {
      labelEl.innerText = "Xu hướng chi tiêu TĂNG";
    } else if (data.change_pct < -5) {
      labelEl.innerText = "Xu hướng chi tiêu GIẢM";
    } else {
      labelEl.innerText = "Xu hướng chi tiêu ỔN ĐỊNH";
    }
  }
}
