// frontend/static/js/analytics.js
// Trang Analytics: lấy dữ liệu thật từ BE, render KPI, biểu đồ, bảng giao dịch

import { apiCall } from "./api.js";

// ========================= Utils hiển thị =========================
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
  // "YYYY-MM-DD" -> "DD/MM/YYYY"
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toast(msg, type = "info") {
  try {
    // nếu app.js của bạn có showToast thì dùng
    // @ts-ignore
    if (window.showToast) return window.showToast(msg, type);
  } catch {}
  console.log(`[${type}]`, msg);
}

// ========================= DOM helper =========================
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
function toISO(d) {
  // Date -> "YYYY-MM-DD"
  return d.toISOString().slice(0, 10);
}

function updateRangeLabel() {
  const lbl = document.getElementById("rangeLabel");
  if (!lbl) return;
  const { from, to } = getTxFilters();
  if (from && to)
    lbl.textContent = `${formatDateVN(from)} → ${formatDateVN(to)}`;
  else lbl.textContent = "";
}

// ========================= CHART state =========================
// Lưu instance Chart.js để destroy khi re-render
const CH = {};
function drawChart(canvasId, cfg) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (CH[canvasId]) CH[canvasId].destroy();
  CH[canvasId] = new Chart(el, cfg);
  return CH[canvasId];
}

// Bảng màu ổn định cho pie chart danh mục chi tiêu
// Nếu BE trả các tên khác vẫn map được theo thứ tự labels
const PIE_COLORS = [
  "rgba(255, 99, 132, 0.8)", // đỏ hồng - Ăn uống
  "rgba(54, 162, 235, 0.8)", // xanh dương - Di chuyển
  "rgba(255, 206, 86, 0.8)", // vàng - Giáo trình/Học tập
  "rgba(75, 192, 192, 0.8)", // xanh ngọc - Giải trí
  "rgba(153, 102, 255, 0.8)", // tím - Nhà trọ
  "rgba(255, 159, 64, 0.8)", // cam - Khác
];

// lưu cache giao dịch đã load gần nhất để dùng cho piechart fallback
let lastTxRows = [];

// Gom nhóm CHI TIÊU theo danh mục dựa trên lastTxRows
function buildExpenseBreakdownFromTx() {
  const map = {};
  lastTxRows
    .filter((r) => String(r.kind || "").toLowerCase() === "expense")
    .forEach((r) => {
      const cat = r.category || "Khác";
      const amt = Number(r.amount) || 0;
      map[cat] = (map[cat] || 0) + amt;
    });

  // trả dạng [{category:"Di chuyển", total: 150000}, ...]
  return Object.keys(map).map((catName) => ({
    category: catName,
    total: map[catName],
  }));
}

// Gom nhóm THU NHẬP theo danh mục dựa trên lastTxRows
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

// ========================= 1. LOAD SUMMARY (KPI + CHART DATA) =========================

async function fetchSummaryByType(summaryType) {
  // summaryType: "expense" hoặc "income"
  const { from, to } = getTxFilters();
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  qs.set("type", summaryType);

  try {
    const data = await apiCall(
      `/api/analytics/summary?${qs.toString()}`,
      "GET"
    );
    console.log("[fetchSummaryByType]", summaryType, data);
    return data || {};
  } catch (err) {
    console.error("fetchSummaryByType error:", summaryType, err);
    return {};
  }
}

function renderPieExpense(summaryExpense) {
  const wrapper = document.getElementById("cardPieExpense");
  const legendEl = document.getElementById("pieExpenseLegend");
  if (!wrapper) return;

  // 1. Lấy dữ liệu chi tiêu theo danh mục
  let catArr = Array.isArray(summaryExpense.expense_by_category)
    ? summaryExpense.expense_by_category
    : [];

  if (!catArr.length) {
    // fallback từ các giao dịch đã load
    catArr = buildExpenseBreakdownFromTx();
    console.log("[renderPieExpense] fallback từ lastTxRows:", catArr);
  } else {
    console.log("[renderPieExpense] từ BE:", catArr);
  }

  // 2. Chuẩn bị labels, values
  let labels = catArr.map((item) => item.category || "Khác");
  let values = catArr.map((item) => Number(item.total || 0));

  // Nếu sau fallback vẫn rỗng -> dummy
  if (!labels.length) {
    wrapper.style.display = "";
    labels = ["Không có dữ liệu"];
    values = [1];
    const dummyColor = "rgba(200,200,200,0.5)";

    drawChart("pieExpense", {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: [dummyColor],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: () => "Không có dữ liệu",
            },
          },
        },
      },
    });

    if (legendEl) {
      legendEl.innerHTML = `
        <li class="text-muted">Không có dữ liệu</li>
      `;
    }
    return;
  }

  wrapper.style.display = "";

  // 3. Tạo màu cho từng lát
  const colors = labels.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]);

  // 4. Vẽ pie chart
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
        legend: { display: false }, // chúng ta tự render legend
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

  // 5. Render legend tùy chỉnh (category | số tiền | %)
  renderLegend(legendEl, labels, values, colors);
}

function renderPieIncome(summaryIncome) {
  const wrapper = document.getElementById("cardPieIncome");
  const legendEl = document.getElementById("pieIncomeLegend");
  if (!wrapper) return;

  // 1. Lấy dữ liệu thu nhập theo danh mục
  let catArr = Array.isArray(summaryIncome.income_by_category)
    ? summaryIncome.income_by_category
    : [];

  if (!catArr.length) {
    catArr = buildIncomeBreakdownFromTx();
    console.log("[renderPieIncome] fallback từ lastTxRows:", catArr);
  } else {
    console.log("[renderPieIncome] từ BE:", catArr);
  }

  // 2. Chuẩn bị labels, values
  let labels = catArr.map((item) => item.category || "Khác");
  let values = catArr.map((item) => Number(item.total || 0));

  if (!labels.length) {
    wrapper.style.display = "";
    labels = ["Không có dữ liệu"];
    values = [1];
    const dummyColor = "rgba(200,200,200,0.5)";

    drawChart("pieIncome", {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: [dummyColor],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: () => "Không có dữ liệu",
            },
          },
        },
      },
    });

    if (legendEl) {
      legendEl.innerHTML = `<li class="text-muted">Không có dữ liệu</li>`;
    }
    return;
  }

  wrapper.style.display = "";

  // 3. Màu sắc cho từng lát (dịch 1 offset để khác pieExpense)
  const colors = labels.map((_, i) => PIE_COLORS[(i + 2) % PIE_COLORS.length]);

  // 4. Vẽ pie thu nhập
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

  // 5. Render legend thu nhập
  renderLegend(legendEl, labels, values, colors);
}

function renderLegend(listEl, labels, values, colors) {
  if (!listEl) return;
  const sum = values.reduce((s, x) => s + x, 0) || 1;

  listEl.innerHTML = labels
    .map((label, idx) => {
      const val = values[idx] || 0;
      const pct = ((val / sum) * 100).toFixed(1); // vd "35.8"
      const color = colors[idx];

      return `
        <li class="d-flex justify-content-between align-items-start mb-2">
          <div class="d-flex align-items-start">
            <span class="d-inline-block rounded-circle me-2 flex-shrink-0"
                  style="width:10px;height:10px;background:${color};"></span>
            <div class="text-wrap">
              <div class="fw-normal text-body">${label}</div>
            </div>
          </div>
          <div class="text-end flex-shrink-0 ms-2">
            <div class="fw-semibold">${formatCurrency(val)}</div>
            <div class="text-muted">(${pct}%)</div>
          </div>
        </li>
      `;
    })
    .join("");
}

async function refreshPieCharts() {
  const { type } = getTxFilters();

  const cardPieExpense = document.getElementById("cardPieExpense");
  const cardPieIncome = document.getElementById("cardPieIncome");

  console.log("[refreshPieCharts] filterType =", type);

  if (type === "all") {
    const [sumExp, sumInc] = await Promise.all([
      fetchSummaryByType("expense"),
      fetchSummaryByType("income"),
    ]);

    if (cardPieExpense) cardPieExpense.style.display = "";
    renderPieExpense(sumExp);

    if (cardPieIncome) cardPieIncome.style.display = "";
    renderPieIncome(sumInc);

    return;
  }

  if (type === "expense") {
    const sumExp = await fetchSummaryByType("expense");

    if (cardPieExpense) cardPieExpense.style.display = "";
    renderPieExpense(sumExp);

    if (cardPieIncome) cardPieIncome.style.display = "none";
    return;
  }

  if (type === "income") {
    const sumInc = await fetchSummaryByType("income");

    if (cardPieIncome) cardPieIncome.style.display = "";
    renderPieIncome(sumInc);

    if (cardPieExpense) cardPieExpense.style.display = "none";
    return;
  }
}

let analyticsSummary = null;

async function loadAnalyticsSummary() {
  const { from, to, type } = getTxFilters();

  // Gọi BE: /api/analytics/summary?from=...&to=...&type=...
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (type) qs.set("type", type);

  try {
    analyticsSummary = await apiCall(
      `/api/analytics/summary?${qs.toString()}`,
      "GET"
    );
  } catch (err) {
    console.error("loadAnalyticsSummary error:", err);
    toast("Không thể tải dữ liệu phân tích", "error");
    analyticsSummary = null;
  }

  updateKPI();
  renderChartsFromSummary();
  renderAIFromSummary();
}

// ----- Update KPI cards trên cùng -----
function updateKPI() {
  if (!analyticsSummary) return;

  // BE nên trả kiểu:
  // {
  //   kpi: {
  //     total_expense,
  //     avg_per_day,
  //     tx_count,
  //     saving_rate,       // 0..1
  //     month_trend_pct    // 0..1 (so với tháng trước)
  //   },
  //   ...
  // }

  const kpi = analyticsSummary.kpi || {};

  const totalExpense = kpi.total_expense || 0;
  const avgPerDay = kpi.avg_per_day || 0;
  const txCount = kpi.tx_count || 0;
  const savingRate = kpi.saving_rate || 0; // 0..1
  const monthTrendPct = kpi.month_trend_pct || 0; // 0..1

  const kpiTotal = document.getElementById("kpiTotal");
  const kpiDaily = document.getElementById("kpiDaily");
  const kpiCount = document.getElementById("kpiCount");
  const kpiTrend = document.getElementById("kpiTrend");
  const kpiSaveRate = document.getElementById("kpiSaveRate");
  const kpiSaveBar = document.getElementById("kpiSaveBar");

  if (kpiTotal) kpiTotal.textContent = formatCurrency(totalExpense);
  if (kpiDaily) kpiDaily.textContent = formatCurrency(avgPerDay);
  if (kpiCount) kpiCount.textContent = txCount;

  if (kpiTrend)
    kpiTrend.textContent = `${(monthTrendPct * 100).toFixed(
      1
    )}% so với tháng trước`;

  if (kpiSaveRate)
    kpiSaveRate.textContent = `${(savingRate * 100).toFixed(1)}%`;

  if (kpiSaveBar) kpiSaveBar.style.width = `${savingRate * 100}%`;
}

// ----- Render Charts -----
function renderChartsFromSummary() {
  if (!analyticsSummary) return;

  // 1) Xu hướng chi theo ngày (lineDaily)
  // analyticsSummary.daily_expense = [ {date:"2025-10-21", total:80000}, ... ]
  const dailyArr = Array.isArray(analyticsSummary.daily_expense)
    ? analyticsSummary.daily_expense.slice()
    : [];
  dailyArr.sort((a, b) => a.date.localeCompare(b.date));

  drawChart("lineDaily", {
    type: "line",
    data: {
      labels: dailyArr.map((d) => new Date(d.date).toLocaleDateString("vi-VN")),
      datasets: [
        {
          label: "Chi tiêu (₫)",
          data: dailyArr.map((d) => d.total || 0),
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
  // 3) So sánh theo tháng (barMonthly)
  // analyticsSummary.monthly_expense = [
  //   { month:"2025-08", total: 3100000 },
  //   { month:"2025-09", total: 2900000 },
  //   { month:"2025-10", total: 3400000 }
  // ]
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
          data: monthArr.map((m) => m.total || 0),
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

  // 4) lineCategory
  // (hiện chưa có API chi tiết từng category theo thời gian, nên mock tạm
  drawChart("lineCategory", {
    type: "line",
    data: {
      labels: ["10", "11", "12", "01", "02"],
      datasets: [
        {
          label: "Ăn uống",
          data: [330, 420, 380, 470, 450],
          borderColor: "#36a2eb",
        },
        {
          label: "Di chuyển",
          data: [260, 290, 270, 300, 280],
          borderColor: "#ff6384",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
    },
  });

  // 5) savingsTrend
  // (cũng mock tạm cho phần tiết kiệm)
  drawChart("savingsTrend", {
    type: "line",
    data: {
      labels: ["10", "11", "12", "01", "02"],
      datasets: [
        {
          label: "Tiết kiệm (₫)",
          data: [240, 170, 320, 150, 260],
          fill: true,
          backgroundColor: "rgba(75,192,192,.2)",
          borderColor: "#4bc0c0",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
    },
  });
}

// ----- Biểu đồ Chi tiêu vs Ngân sách -----
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

    const arr = Array.isArray(data.items) ? data.items : [];

    // fallback nếu rỗng
    if (!arr.length) {
      drawChart("barBudget", {
        type: "bar",
        data: {
          labels: ["Không có dữ liệu"],
          datasets: [
            {
              label: "Chi tiêu",
              data: [0],
              backgroundColor: "rgba(54,162,235,0.7)",
              borderColor: "rgba(54,162,235,1)",
              borderWidth: 1,
              borderRadius: 6,
            },
            {
              label: "Ngân sách",
              data: [0],
              backgroundColor: "rgba(201,203,207,0.6)",
              borderColor: "rgba(201,203,207,1)",
              borderWidth: 1,
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "bottom" },
            tooltip: { enabled: false },
          },
          scales: {
            x: {
              stacked: false,
              title: { display: true, text: "Danh mục" },
            },
            y: {
              stacked: false,
              beginAtZero: true,
              title: { display: true, text: "Số tiền (₫)" },
              ticks: {
                callback: (val) => formatCurrency(val),
              },
            },
          },
        },
      });
      return;
    }

    // chuẩn hoá data
    const labels = arr.map((x) => x.category);
    const spentVals = arr.map((x) => Number(x.expense || 0));
    const budgetVals = arr.map((x) => Number(x.budget || 0));

    // vẽ biểu đồ 2 dataset cạnh nhau (grouped bars)
    drawChart("barBudget", {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Chi tiêu",
            data: spentVals,
            backgroundColor: "rgba(54,162,235,0.7)", // xanh
            borderColor: "rgba(54,162,235,1)",
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: "Ngân sách",
            data: budgetVals,
            backgroundColor: "rgba(201,203,207,0.6)", // xám nhạt
            borderColor: "rgba(201,203,207,1)",
            borderWidth: 1,
            borderRadius: 6,
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
                `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            stacked: false, // rất quan trọng: 2 cột đứng cạnh nhau
            title: {
              display: true,
              text: "Danh mục",
            },
          },
          y: {
            stacked: false,
            beginAtZero: true,
            title: {
              display: true,
              text: "Số tiền (₫)",
            },
            ticks: {
              callback: (val) => formatCurrency(val),
            },
          },
        },
      },
    });
  } catch (err) {
    console.error("renderBudgetComparison error:", err);
  }
}

// ----- Render AI panel từ summary -----
function renderAIFromSummary() {
  if (!analyticsSummary) return;

  // analyticsSummary.ai = {
  //   score: 8.2,
  //   tips: ["...", "..."]
  // }
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

// helper nhỏ để tránh XSS
function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}

// ========================= 2. LOAD TRANSACTIONS (BẢNG) =========================
async function loadTransactions() {
  const tbody = document.getElementById("txTable");
  if (!tbody) return;

  const { from, to, type } = getTxFilters();

  try {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);

    let rows = [];
    if (type === "expense") {
      // chỉ chi tiêu
      const exp = await apiCall(
        `/api/analytics/expenses?${qs.toString()}`,
        "GET"
      );
      rows = normalizeRows(exp || [], "expense");
    } else if (type === "income") {
      // chỉ thu nhập
      const inc = await apiCall(
        `/api/analytics/incomes?${qs.toString()}`,
        "GET"
      );
      rows = normalizeRows(inc || [], "income");
    } else {
      // cả hai
      const both = await apiCall(
        `/api/analytics/transactions?${qs.toString()}`,
        "GET"
      );
      rows = normalizeUnion(both || []);
    }

    // sort: mới nhất lên trên
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    // lưu cache để pie chart còn biết nhóm theo danh mục
    lastTxRows = rows.slice();

    renderTransactions(rows);
  } catch (e) {
    console.error("loadTransactions error:", e);
    renderTransactions([]);
    lastTxRows = []; // fallback sạch nếu lỗi
  }

  updateRangeLabel();
}

function normalizeRows(raw, kind) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const date =
        r.date ||
        r.spent_at ||
        r.received_at ||
        r.transaction_date ||
        r.created_at?.slice(0, 10) ||
        null;

      const desc = r.desc || r.description || r.note || r.source || "";
      const category =
        r.category ||
        r.category_name ||
        (kind === "income" ? "Thu nhập khác" : "Khác");

      const method =
        r.method ||
        r.payment_method ||
        r.method_name ||
        (kind === "income" ? "" : "");

      const amount = Number(r.amount) || 0;

      return { date, desc, category, method, amount, kind };
    })
    .filter((x) => !!x.date);
}

function normalizeUnion(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const k = String(r.kind || "").toLowerCase();
      const kind = k === "income" ? "income" : "expense";
      return {
        date:
          r.date ||
          r.spent_at ||
          r.received_at ||
          r.transaction_date ||
          r.created_at?.slice(0, 10) ||
          null,
        desc: r.desc || r.description || r.note || r.source || "",
        category:
          r.category ||
          r.category_name ||
          (kind === "income" ? "Thu nhập" : "Khác"),
        method: r.method || r.method_name || r.payment_method || "",
        amount: Number(r.amount) || 0,
        kind,
      };
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
          <td>${escapeHtml(r.category)}</td>
          <td>${escapeHtml(r.method)}</td>
          <td class="text-end ${cls} fw-semibold">
            ${sign}${formatCurrency(r.amount)}
          </td>
        </tr>`;
    })
    .join("");
}

// ========================= 3. SỰ KIỆN & KHỞI TẠO =========================
function wireEvents() {
  const btnApply = document.getElementById("btnApply");
  const typeSel = document.getElementById("filterType");

  const onApply = async () => {
    // 1. load giao dịch -> cập nhật lastTxRows
    await loadTransactions();

    // 2. load summary -> cập nhật KPI + line/bar/etc
    await loadAnalyticsSummary();

    // 3. vẽ lại pies với dữ liệu mới nhất
    refreshPieCharts();

    // 4. vẽ lại biểu đồ Chi tiêu vs Ngân sách (dùng dữ liệu thật)
    await renderBudgetComparison();
  };

  if (btnApply) btnApply.addEventListener("click", onApply);
  if (typeSel) typeSel.addEventListener("change", onApply);
}

document.addEventListener("DOMContentLoaded", async () => {
  setDefaultRangeIfEmpty();
  wireEvents();

  // Lần đầu vào trang:
  // 1. giao dịch -> có lastTxRows
  await loadTransactions();

  // 2. summary -> KPI + line + bar + tiết kiệm
  await loadAnalyticsSummary();

  // 3. pie -> dùng breakdown (BE hoặc fallback từ lastTxRows)
  refreshPieCharts();

  // 4. Chi tiêu vs Ngân sách
  await renderBudgetComparison();
});
