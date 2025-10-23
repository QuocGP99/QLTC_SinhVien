// analytics.js — dùng dữ liệu thật (summary + transactions)
import { apiCall } from "./api.js";

// ====== Helpers nhỏ (tự hoạt động nếu bạn chưa có utils) ======
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
function formatPercent(n) {
  // n: 0..1 -> "12,3 %"
  const v = Number(n || 0) * 100;
  return `${v.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} %`;
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
function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}

// ====== Summary (có sẵn của bạn) ======
let analyticsData = null;

async function loadAnalytics() {
  try {
    analyticsData = await apiCall("/api/analytics/summary", "GET");
    updateSummary();
    renderCharts();
  } catch (error) {
    console.error(error);
    toast("Không thể tải dữ liệu phân tích", "error");
  }
}

function updateSummary() {
  if (!analyticsData) return;
  const {
    total_income = 0,
    total_expenses = 0,
    total_savings = 0,
  } = analyticsData;
  const elIncome = document.getElementById("totalIncome");
  const elExpense = document.getElementById("totalExpenses");
  const elSaving = document.getElementById("totalSavings");
  if (elIncome) elIncome.textContent = formatCurrency(total_income);
  if (elExpense) elExpense.textContent = formatCurrency(total_expenses);
  if (elSaving) elSaving.textContent = formatCurrency(total_savings);
}

function renderCharts() {
  // Giữ nguyên phần biểu đồ bạn đã có (nếu cần thêm, mình bổ sung sau)
}

// ====== AI insights (có sẵn của bạn) ======
async function loadAIInsights() {
  const scoreEl = document.getElementById("aiScore");
  const barEl = document.getElementById("aiScoreBar");
  const tipsEl = document.getElementById("aiTips");
  if (!scoreEl || !barEl || !tipsEl) return;
  try {
    const insights = await apiCall("/api/analytics/ai-insights", "GET");
    const rate = Number(insights?.saving_rate || 0); // 0..1
    const pct = Math.round(rate * 100);

    scoreEl.textContent = (pct / 10).toFixed(1); // ví dụ hiển thị dạng 8.2 nếu 82%
    barEl.style.width = `${pct}%`;

    const tips = Array.isArray(insights?.recommendations)
      ? insights.recommendations
      : [];
    tipsEl.innerHTML = tips
      .map((t) => `<li class="list-group-item">${escapeHtml(t)}</li>`)
      .join("");
  } catch (e) {
    console.error(e);
    tipsEl.innerHTML = `<li class="list-group-item text-muted">Không thể tải AI insights</li>`;
  }
}

function updateRangeLabel() {
  const lbl = document.getElementById("rangeLabel");
  if (!lbl) return;
  const { from, to } = getTxFilters();
  if (from && to)
    lbl.textContent = `${formatDateVN(from)} → ${formatDateVN(to)}`;
}

// ====== TRANSACTIONS — NEW ======
function getTxFilters() {
  const from = document.getElementById("fromDate")?.value || "";
  const to = document.getElementById("toDate")?.value || "";
  const type = document.getElementById("filterType")?.value || "all"; // all|expense|income
  return { from, to, type };
}

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
      const exp = await apiCall(
        `/api/analytics/expenses?${qs.toString()}`,
        "GET"
      );
      rows = normalizeRows(exp || [], "expense");
    } else if (type === "income") {
      const inc = await apiCall(
        `/api/analytics/incomes?${qs.toString()}`,
        "GET"
      );
      rows = normalizeRows(inc || [], "income");
    } else {
      const both = await apiCall(
        `/api/analytics/transactions?${qs.toString()}`,
        "GET"
      );
      rows = normalizeUnion(both || [], "all");
    }
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderTransactions(rows);
  } catch (e) {
    console.error(e);
    renderTransactions([]);
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
      const k = String(r.kind || "").toLowerCase(); // <-- CHUẨN HOÁ kind
      const kind = k === "income" ? "income" : "expense";
      return {
        date:
          r.date ||
          r.spent_at ||
          r.received_at ||
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
      // Nhận diện income/expense AN TOÀN cho cả chế độ "Tất cả"
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
      </tr>
    `;
    })
    .join("");
}

// ====== INIT & EVENTS ======
function setDefaultRangeIfEmpty() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  const f = document.getElementById("fromDate");
  const t = document.getElementById("toDate");
  if (f && !f.value) f.value = from.toISOString().slice(0, 10);
  if (t && !t.value) t.value = to.toISOString().slice(0, 10);
}

function wireEvents() {
  const btnApplyA = document.getElementById("btnApply");
  const btnApplyB = document.getElementById("btnApplyFilter");
  const onApply = () => {
    loadTransactions();
    loadAnalytics();
    loadAIInsights();
  };
  if (btnApplyA) btnApplyA.addEventListener("click", onApply);
  if (btnApplyB) btnApplyB.addEventListener("click", onApply);

  const typeSel = document.getElementById("filterType");
  if (typeSel) {
    typeSel.addEventListener("change", onApply);
  }
}

function toast(msg, type = "info") {
  try {
    // nếu bạn đã có showToast ở app.js
    // @ts-ignore
    if (window.showToast) return window.showToast(msg, type);
  } catch {}
  console.log(`[${type}]`, msg);
}

document.addEventListener("DOMContentLoaded", () => {
  setDefaultRangeIfEmpty();
  wireEvents();

  // lần đầu vào trang
  loadAnalytics();
  loadAIInsights();
  loadTransactions();
});
