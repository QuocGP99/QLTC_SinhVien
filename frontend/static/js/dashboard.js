(function () {
  // ===== Helpers chung cho call API =====
  const API_BASE = window.BASE_API_URL || "http://127.0.0.1:5000";

  function getToken() {
    return localStorage.getItem("access_token") || "";
  }

  function authHeaders(isJson = false) {
    const t = getToken();
    const h = isJson ? { "Content-Type": "application/json" } : {};
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

  const Money = {
    pretty(val) {
      return Number(val || 0).toLocaleString("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      });
    },
    cell(tx) {
      const isIncome = tx.type === "income";
      const prefix = isIncome ? "+" : "-";
      const cls = isIncome ? "text-success" : "text-danger";
      return `<div class="fw-semibold ${cls}">
        ${prefix}${Money.pretty(tx.amount)}
      </div>`;
    },
  };

  function formatDateVN(isoDateStr) {
    if (!isoDateStr) return "";
    const d = new Date(isoDateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  }

  // ====================== CATEGORY COLOR FROM CSS ======================
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

  // ===== Charts =====
  async function renderSpendLastMonths() {
    const ctxBar = document.getElementById("spendTrend");
    if (!ctxBar) return;

    let data;
    try {
      data = await apiGet("/api/analytics/summary", { range: "last_6_months" });
    } catch (err) {
      console.error("load monthly_expense error:", err);
      return;
    }

    const items = data?.monthly_expense?.slice(-5) || [];
    if (!items.length) return;

    const labels = items.map((m) => "Th " + m.month.split("-")[1]);
    const values = items.map((m) => Number(m.total || 0));

    new Chart(ctxBar, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Chi tiêu (₫)",
            data: values,
            backgroundColor: "#93c5fd",
          },
        ],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
  }

  // ===== Piechart =====
  async function renderCategoryPie() {
    const ctxPie = document.getElementById("categoryPie");
    const tbl = document.getElementById("categoryTable");
    if (!ctxPie || !tbl) return;

    tbl.innerHTML = `<tr><td>Đang tải...</td></tr>`;

    let data;
    try {
      data = await apiGet("/api/analytics/summary", { range: "current_month" });
    } catch (err) {
      console.error("pie error:", err);
      return;
    }

    const catArr = data?.expense_by_category || [];
    if (!catArr.length) return;

    const labels = catArr.map((c) => c.category);
    const values = catArr.map((c) => Number(c.total || 0));

    // Màu cho pie + bảng
    const colors = labels.map((label, i) => getCategoryColorFromCSS(label));

    // Draw pie
    new Chart(ctxPie, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: labels.map((label) =>
              getCategoryColorFromCSS(label)
            ),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    });

    // Render category detail table
    tbl.innerHTML = "";
    catArr.forEach((c, i) => {
      tbl.insertAdjacentHTML(
        "beforeend",
        `
      <tr>
        <td class="text-nowrap">
          <span class="badge rounded-pill" 
                style="background:${getCategoryColorFromCSS(
                  c.category
                )};">&nbsp;</span>
          ${c.category}
        </td>
        <td class="text-end">${Money.pretty(c.total)}</td>
      </tr>
      `
      );
    });
  }

  // ===== Bảng chi tiêu theo danh mục =====

  //Giao dịch gần đây
  async function loadRecentTransactions() {
    const recentList = document.getElementById("recentList");
    if (!recentList) return;

    recentList.innerHTML = `
    <div class="text-muted small fst-italic">Đang tải giao dịch gần đây...</div>
  `;

    try {
      // Gọi 2 API
      const [expRes, incRes] = await Promise.all([
        apiGet("/api/expenses", { limit: 5 }),
        apiGet("/api/incomes", { limit: 5 }),
      ]);

      const expenseItems = Array.isArray(expRes?.items) ? expRes.items : [];
      const incomeItems = Array.isArray(incRes?.items) ? incRes.items : [];

      function toTs(dateStr) {
        if (!dateStr) return 0;
        const t = new Date(dateStr).getTime();
        return Number.isNaN(t) ? 0 : t;
      }

      const expenses = expenseItems.map((tx) => ({
        id: tx.id,
        type: "expense",
        desc: tx.desc || "(không mô tả)",
        category_name: tx.category || "Chi tiêu",
        date: tx.date,
        ts: toTs(tx.date),
        amount: Number(tx.amount || 0),
      }));

      const incomes = incomeItems.map((tx) => ({
        id: tx.id,
        type: "income",
        desc: tx.note || "(không mô tả)",
        category_name: tx.category || "Thu nhập",
        date: tx.received_at,
        ts: toTs(tx.received_at),
        amount: Number(tx.amount || 0),
      }));

      const merged = [...expenses, ...incomes].sort((a, b) => {
        if (b.ts !== a.ts) return b.ts - a.ts;
        return (b.id || 0) - (a.id || 0);
      });

      const top5 = merged.slice(0, 5);

      if (!top5.length) {
        recentList.innerHTML = `
        <div class="text-muted small fst-italic">Chưa có giao dịch nào</div>
      `;
        return;
      }

      recentList.innerHTML = "";

      top5.forEach((tx) => {
        recentList.insertAdjacentHTML(
          "beforeend",
          `
        <div class="d-flex justify-content-between align-items-center border rounded-3 px-3 py-2">
          <div class="me-2">
            <div class="fw-semibold">${tx.desc}</div>
            <div class="small text-muted">
              ${tx.category_name} • ${formatDateVN(tx.date)}
            </div>
          </div>
          ${Money.cell(tx)}
        </div>
        `
        );
      });
    } catch (err) {
      console.error("Lỗi loadRecentTransactions:", err);
      recentList.innerHTML = `
      <div class="text-danger small fst-italic">
        Không tải được giao dịch gần đây
      </div>
    `;
    }
  }

  // ===== Tổng quan ngân sách trên dashboard =====
  async function loadBudgetOverview() {
    const monthLabelEl = document.getElementById("budgetMonthLabel");
    const usedVsLimitEl = document.getElementById("budgetUsedVsLimit");
    const percentUsedEl = document.getElementById("budgetPercentUsed");
    const progressBarEl = document.getElementById("budgetProgressBar");
    const budgetListEl = document.getElementById("budgetList");

    // Nếu layout không có block ngân sách (ví dụ mobile ẩn card) -> trả default cho KPI
    if (
      !monthLabelEl ||
      !usedVsLimitEl ||
      !percentUsedEl ||
      !progressBarEl ||
      !budgetListEl
    ) {
      return {
        totalSpent: 0,
        totalBudget: 0,
        totalPct: 0,
      };
    }

    // Trạng thái chờ
    budgetListEl.innerHTML = `
      <div class="text-muted small fst-italic">Đang tải ngân sách...</div>
    `;

    // "YYYY-MM"
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const monthStr = `${yyyy}-${mm}`;

    // label hiển thị
    monthLabelEl.textContent = `Ngân sách tháng ${mm}/${yyyy}`;

    // gọi API
    let resp;
    try {
      resp = await apiGet("/api/budgets/summary", { month: monthStr });
    } catch (err) {
      console.error("Lỗi load ngân sách:", err);
      usedVsLimitEl.textContent = `${Money.pretty(0)} / ${Money.pretty(0)}`;
      percentUsedEl.textContent = `0% sử dụng`;
      progressBarEl.style.width = "0%";
      progressBarEl.className = "progress-bar bg-success";
      budgetListEl.innerHTML = `
        <div class="text-muted small fst-italic">Không tải được dữ liệu ngân sách</div>
      `;
      return {
        totalSpent: 0,
        totalBudget: 0,
        totalPct: 0,
      };
    }

    if (!resp || !resp.success || !resp.data) {
      usedVsLimitEl.textContent = `${Money.pretty(0)} / ${Money.pretty(0)}`;
      percentUsedEl.textContent = `0% sử dụng`;
      progressBarEl.style.width = "0%";
      progressBarEl.className = "progress-bar bg-success";
      budgetListEl.innerHTML = `
        <div class="text-muted small fst-italic">Chưa có ngân sách cho tháng này</div>
      `;
      return {
        totalSpent: 0,
        totalBudget: 0,
        totalPct: 0,
      };
    }

    const data = resp.data;

    const totalBudget = Number(data.total_budget || 0);
    const totalSpent = Number(data.total_spent || 0);

    let totalPct = Number.isFinite(data.percent_used)
      ? Math.round(data.percent_used)
      : totalBudget
      ? Math.round((totalSpent * 100) / totalBudget)
      : 0;

    if (totalPct < 0) totalPct = 0;
    if (totalPct > 100) totalPct = 100;

    // màu thanh tổng
    let totalBarClass = "bg-success";
    if (totalPct >= 90) {
      totalBarClass = "bg-danger";
    } else if (totalPct >= 70) {
      totalBarClass = "bg-warning";
    }

    // set tổng quan
    usedVsLimitEl.textContent = `${Money.pretty(totalSpent)} / ${Money.pretty(
      totalBudget
    )}`;
    percentUsedEl.textContent = `${totalPct}% đã dùng`;
    progressBarEl.className = `progress-bar ${totalBarClass}`;
    progressBarEl.style.width = `${totalPct}%`;

    // chi tiết từng danh mục
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      budgetListEl.innerHTML = `
        <div class="text-muted small fst-italic">Chưa có ngân sách danh mục</div>
      `;
      return {
        totalSpent,
        totalBudget,
        totalPct,
      };
    }

    budgetListEl.innerHTML = "";

    items.forEach((it) => {
      const limit = Number(it.amount ?? it.limit ?? 0);
      const spent = Number(it.spent ?? it.used ?? 0);

      let pct = Number.isFinite(it.percent_used)
        ? Math.round(it.percent_used)
        : limit
        ? Math.min(100, Math.round((spent * 100) / limit))
        : 0;

      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;

      let barCls = "bg-success";
      if (pct >= 90) {
        barCls = "bg-danger";
      } else if (pct >= 70) {
        barCls = "bg-warning";
      }

      budgetListEl.insertAdjacentHTML(
        "beforeend",
        `
        <div>
          <div class="d-flex justify-content-between small">
            <span>${it.category || it.category_name || "Danh mục"}</span>
            <span>${Money.pretty(spent)} / ${Money.pretty(limit)}</span>
          </div>
          <div class="progress" style="height:8px;">
            <div class="progress-bar ${barCls}" style="width:${pct}%"></div>
          </div>
        </div>
        `
      );
    });

    return {
      totalSpent,
      totalBudget,
      totalPct,
    };
  }

  // ===== Mục tiêu tiết kiệm =====
  async function loadSavingsOverview() {
    const listEl = document.getElementById("savingsGoals");
    const totalBarEl = document.getElementById("savingsTotalBar");
    const totalTextEl = document.getElementById("savingsTotalText");

    // Nếu layout không có block tiết kiệm (ví dụ mobile ẩn card)
    if (!listEl) {
      return {
        totalCurrent: 0,
        totalTarget: 0,
        totalPct: 0,
      };
    }

    // trạng thái đang tải trong danh sách mục tiêu
    listEl.innerHTML =
      '<div class="text-muted small fst-italic">Đang tải mục tiêu...</div>';

    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    let data;
    try {
      const res = await fetch(API_BASE + "/api/savings", {
        headers,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      data = await safeJson(res);
    } catch (err) {
      console.error("Lỗi load savings:", err);

      // UI tổng
      if (totalBarEl) {
        totalBarEl.className = "progress-bar bg-success";
        totalBarEl.style.width = "0%";
      }
      if (totalTextEl) {
        totalTextEl.textContent = "₫0 / ₫0";
      }

      // UI list
      listEl.innerHTML =
        '<div class="text-muted small fst-italic">Không tải được mục tiêu tiết kiệm</div>';

      return {
        totalCurrent: 0,
        totalTarget: 0,
        totalPct: 0,
      };
    }

    // backend có thể trả {items:[...]} hoặc [...], mình cover cả hai
    const items = data.items || data || [];
    if (!items.length) {
      if (totalBarEl) {
        totalBarEl.className = "progress-bar bg-success";
        totalBarEl.style.width = "0%";
      }
      if (totalTextEl) {
        totalTextEl.textContent = "₫0 / ₫0";
      }

      listEl.innerHTML =
        '<div class="text-muted small fst-italic">Chưa có mục tiêu tiết kiệm</div>';

      return {
        totalCurrent: 0,
        totalTarget: 0,
        totalPct: 0,
      };
    }

    // Tính tổng tiền đã tiết kiệm và tổng mục tiêu
    let totalCurrent = 0;
    let totalTarget = 0;
    items.forEach((g) => {
      totalCurrent += Number(g.current_amount || 0);
      totalTarget += Number(g.target_amount || 0);
    });

    // % hoàn thành tổng
    let totalPct = 0;
    if (totalTarget > 0) {
      totalPct = Math.round((totalCurrent * 100) / totalTarget);
      if (totalPct < 0) totalPct = 0;
      if (totalPct > 100) totalPct = 100;
    }

    // Thanh tổng trong card "Mục tiêu tiết kiệm" bên dưới
    // (cái card to ở hàng dưới dashboard)
    if (totalBarEl) {
      totalBarEl.className = "progress-bar bg-success";
      totalBarEl.style.width = totalPct + "%";
    }
    if (totalTextEl) {
      totalTextEl.textContent = `${Money.pretty(totalCurrent)} / ${Money.pretty(
        totalTarget
      )}`;
    }

    // Render tối đa 3 goal trong danh sách
    listEl.innerHTML = "";
    items.slice(0, 3).forEach((g) => {
      const cur = Number(g.current_amount || 0);
      const tgt = Number(g.target_amount || 0);
      const pct = tgt > 0 ? Math.min(100, Math.round((cur * 100) / tgt)) : 0;
      const name = g.name || g.title || "Mục tiêu";

      listEl.insertAdjacentHTML(
        "beforeend",
        `
      <div class="border rounded-3 p-2">
        <div class="d-flex justify-content-between">
          <div class="fw-semibold text-truncate" style="max-width:70%">
            ${name}
          </div>
          <div class="small">${pct}%</div>
        </div>
        <div class="progress my-1" style="height:8px;">
          <div class="progress-bar" style="width:${pct}%"></div>
        </div>
        <div class="small">
          ${Money.pretty(cur)} / ${Money.pretty(tgt)}
        </div>
      </div>
      `
      );
    });

    // "Xem tất cả mục tiêu"
    if (items.length > 3) {
      listEl.insertAdjacentHTML(
        "beforeend",
        `
      <button
        class="btn btn-link p-0 small text-muted text-start"
        id="viewAllSavingsBtn"
        style="text-decoration:none"
      >
        Xem tất cả mục tiêu ›
      </button>
      `
      );
      const viewAllSavingsBtn = document.getElementById("viewAllSavingsBtn");
      if (viewAllSavingsBtn) {
        viewAllSavingsBtn.addEventListener("click", () => {
          window.location.href = "/savings";
        });
      }
    }

    // trả object để KPI tím (trên cùng dashboard) dùng
    return {
      totalCurrent,
      totalTarget,
      totalPct,
    };
  }

  // ===== LOAD TOTAL BALANCE (Tổng thu nhập - Tổng chi tiêu) =====
  async function loadTotalBalance() {
    const elBalance = document.getElementById("kpiBalance");
    if (!elBalance) return;

    try {
      const res = await apiGet("/api/dashboard/balance");
      const balance = Number(res.balance || 0);

      // Cập nhật cho KPI (có hỗ trợ ẩn/hiện)
      if (window.BalanceEyeFeature) {
        window.BalanceEyeFeature.setAmount(balance);
      } else {
        elBalance.textContent = Money.pretty(balance);
      }
    } catch (err) {
      console.error("Lỗi loadTotalBalance:", err);
    }
  }

  // ===== Balance Change (% so với tháng trước) =====
  // ===== Balance Change (% so với tháng trước) =====
  async function loadBalanceChange() {
    // Lấy nhóm chứa 3 dòng: "Số dư tổng", số tiền, % so với tháng trước
    const box = document.querySelector("#kpiBalance")?.parentNode;
    if (!box) return;

    // Đây mới là dòng % chính xác (thẻ small thứ 2)
    const pctEl = box.querySelectorAll(".small.opacity-75")[1];
    if (!pctEl) return;

    try {
      const res = await apiGet("/api/dashboard/balance_change");

      const current = Number(res.balance_this || 0);
      const previous = Number(res.balance_prev || 0);

      let pct = 0;
      if (previous > 0) {
        pct = ((current - previous) / previous) * 100;
      }

      pctEl.textContent =
        (pct >= 0 ? "+" : "") + pct.toFixed(1) + "% so với tháng trước";
    } catch (err) {
      console.error("Lỗi loadBalanceChange:", err);
    }
  }

  // ===== Gọi các loader chính =====
  loadRecentTransactions();
  renderSpendLastMonths();
  renderCategoryPie();
  loadDashboardAI();
  loadTotalBalance();
  loadBalanceChange();

  // ===== Gọi và cập nhật KPI =====
  (async () => {
    // 1. Ngân sách -> cập nhật card KPI màu xanh "Đã chi tháng này"
    const budgetSummary = await loadBudgetOverview();

    const spentEl = document.getElementById("kpiSpent");
    const spentCard = spentEl ? spentEl.closest(".kpi-card") : null;
    let spentPctEl = null;
    if (spentCard) {
      const smalls = spentCard.querySelectorAll(".small.opacity-75");
      // smalls[0] = "Đã chi tháng này"
      // smalls[1] = "xx% hạn mức" (chúng ta sẽ ghi đè)
      spentPctEl = smalls[1] || null;
    }

    if (spentEl) {
      spentEl.textContent = Money.pretty(
        (budgetSummary && budgetSummary.totalSpent) || 0
      );
    }
    if (spentPctEl) {
      const pctNum = Number.isFinite(budgetSummary.totalPct)
        ? budgetSummary.totalPct
        : 0;
      spentPctEl.textContent = `${pctNum}% của ngân sách tháng này`;
    }

    // 2. Tiết kiệm -> cập nhật card KPI màu tím "Mục tiêu tiết kiệm"
    const savingSummary = await loadSavingsOverview();

    const savingEl = document.getElementById("kpiSaving");
    // Dòng hiển thị % đã đạt nằm ngay dưới kpiSaving trong card tím.
    // Cấu trúc card tím:
    //   [0] .small.opacity-75  => "Mục tiêu tiết kiệm"
    //   [1] #kpiSaving         => số tiền (không có class small.opacity-75)
    //   [2] .small.opacity-75  => "25% của ..."
    // Ta sẽ thay [1] và [2].
    let savingPctEl = null;
    if (savingEl) {
      const savingCard = savingEl.closest(".kpi-card");
      if (savingCard) {
        const nodes = savingCard.querySelectorAll(".small.opacity-75");
        // nodes[0] = "Mục tiêu tiết kiệm"
        // nodes[1] = "25% của ₫5.000.000" (cái ta muốn thay)
        savingPctEl = nodes[1] || null;
      }
    }

    // set số tiền tiết kiệm tổng
    if (savingEl) {
      savingEl.textContent = Money.pretty(
        (savingSummary && savingSummary.totalCurrent) || 0
      );
    }

    // set % + tổng số tiền mục tiêu
    if (savingPctEl) {
      const pctNum = Number.isFinite(savingSummary.totalPct)
        ? savingSummary.totalPct
        : 0;
      const totalTarget = Number(savingSummary.totalTarget || 0);
      savingPctEl.textContent = `${pctNum}% của ${Money.pretty(totalTarget)}`;
    }

    // 3. Giao dịch gần đây (load cuối cũng được)
    loadRecentTransactions();
  })();

  // ============= AI HEALTH SCORE FOR DASHBOARD ==============
  async function loadDashboardAI() {
    try {
      const data = await apiGet("/api/dashboard/health_score");

      // Gán điểm AI(nhỏ)
      const scoreBox = document.getElementById("kpiAiScore");
      if (scoreBox) scoreBox.textContent = `${data.score.toFixed(1)}/10`;

      // =====================
      // 1. Tạo statusText dùng chung
      // =====================
      let statusText = "";
      if (data.level === "good") statusText = "Sức khỏe tài chính tốt";
      else if (data.level === "medium") statusText = "Cần cân đối lại chi tiêu";
      else statusText = "Đang gặp vấn đề, cần xem lại tài chính";

      // =====================
      // 2. KPI nhỏ
      // =====================
      const statusBox = document.getElementById("kpiAiStatus");
      if (statusBox) statusBox.textContent = statusText;

      // =====================
      // 3. Panel AI lớn
      // =====================
      const panelScore = document.getElementById("aiPanelScore");
      const panelStatus = document.getElementById("aiPanelStatus");

      if (panelScore) panelScore.textContent = `${data.score.toFixed(1)}/10`;
      if (panelStatus) panelStatus.textContent = statusText;

      // =====================
      // 4. Render gợi ý AI
      // =====================
      const tipsBox = document.getElementById("aiTipsList");
      if (tipsBox) {
        tipsBox.innerHTML = "";

        if (Array.isArray(data.tips) && data.tips.length > 0) {
          data.tips.forEach((tip) => {
            tipsBox.insertAdjacentHTML(
              "beforeend",
              `
        <div class="p-3 rounded-3 border bg-light">
          <div class="fw-semibold">${tip}</div>
        </div>
      `
            );
          });
        } else {
          tipsBox.innerHTML = `
      <div class="text-muted small fst-italic">Không có gợi ý AI</div>`;
        }
      }
    } catch (err) {
      console.error("Lỗi loadDashboardAI:", err);
    }
  }

  // -------------------------
  //  Quick actions on dashboard
  // -------------------------

  // NÚT 1: Thêm giao dịch -> hỏi loại -> xác nhận -> redirect
  const quickAddBtn = document.getElementById("quickAddBtn");

  const chooseTypeEl = document.getElementById("chooseTypeModal");
  const confirmEl = document.getElementById("confirmAddModal");

  const chooseTypeModal =
    chooseTypeEl && window.bootstrap ? new bootstrap.Modal(chooseTypeEl) : null;

  const confirmModal =
    confirmEl && window.bootstrap ? new bootstrap.Modal(confirmEl) : null;

  let pendingType = null; // "expense" | "income"

  if (quickAddBtn && chooseTypeModal) {
    quickAddBtn.addEventListener("click", () => {
      pendingType = null;
      chooseTypeModal.show();
    });
  }

  const btnChooseExpense = document.getElementById("btnChooseExpense");
  if (btnChooseExpense && confirmModal) {
    btnChooseExpense.addEventListener("click", () => {
      pendingType = "expense";
      chooseTypeModal.hide();

      const msgEl = document.getElementById("confirmMessage");
      if (msgEl) {
        msgEl.textContent = "Bạn chắc chắn muốn thêm Chi tiêu này?";
      }

      confirmModal.show();
    });
  }

  const btnChooseIncome = document.getElementById("btnChooseIncome");
  if (btnChooseIncome && confirmModal) {
    btnChooseIncome.addEventListener("click", () => {
      pendingType = "income";
      chooseTypeModal.hide();

      const msgEl = document.getElementById("confirmMessage");
      if (msgEl) {
        msgEl.textContent = "Bạn chắc chắn muốn thêm Thu nhập này?";
      }

      confirmModal.show();
    });
  }

  const btnYesConfirm = document.getElementById("btnYesConfirm");
  const btnNoConfirm = document.getElementById("btnNoConfirm");

  if (btnNoConfirm) {
    btnNoConfirm.addEventListener("click", () => {
      pendingType = null;
    });
  }

  if (btnYesConfirm) {
    btnYesConfirm.addEventListener("click", () => {
      if (confirmModal) confirmModal.hide();

      if (pendingType === "expense") {
        window.location.href = "/transactions/expenses?add=1";
      } else if (pendingType === "income") {
        window.location.href = "/transactions/income?add=1";
      }

      pendingType = null;
    });
  }

  // NÚT 2: Quản lý ngân sách
  const quickBudgetPageBtn = document.getElementById("quickBudgetPageBtn");
  if (quickBudgetPageBtn) {
    quickBudgetPageBtn.addEventListener("click", () => {
      window.location.href = "/budgets";
    });
  }

  const openBudgetPageBtn = document.getElementById("openBudgetPageBtn");
  if (openBudgetPageBtn) {
    openBudgetPageBtn.addEventListener("click", () => {
      window.location.href = "/budgets?scroll=categories";
    });
  }

  // NÚT 3: Đặt mục tiêu tiết kiệm
  const quickAddSavingBtn = document.getElementById("quickAddSavingBtn");
  const confirmAddSavingEl = document.getElementById("confirmAddSavingModal");

  if (quickAddSavingBtn && confirmAddSavingEl && window.bootstrap) {
    const confirmAddSavingModal = new bootstrap.Modal(confirmAddSavingEl);

    quickAddSavingBtn.addEventListener("click", () => {
      confirmAddSavingModal.show();
    });

    const btnYesAddSaving = document.getElementById("btnYesAddSaving");
    if (btnYesAddSaving) {
      btnYesAddSaving.addEventListener("click", () => {
        confirmAddSavingModal.hide();
        window.location.href = "/savings?add=1";
      });
    }
  }

  // "Xem tất cả" giao dịch gần đây
  const viewAllBtn = document.getElementById("viewAllTransactionsBtn");
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", () => {
      window.location.href = "/transactions#recentSection";
    });
  }

  // NÚT "Xem chi tiết" mục tiêu tiết kiệm
  const dashViewSavingsBtn = document.getElementById("dashViewSavingsBtn");
  if (dashViewSavingsBtn) {
    dashViewSavingsBtn.addEventListener("click", () => {
      window.location.href = "/savings?scroll=list";
    });
  }
  // ===== [ADD] Tính năng ẩn/hiện Số dư tổng (nút con mắt) =====
  (function BalanceEyeFeature() {
    const LS_KEY = "kpi_balance_hidden"; // Lưu trạng thái vào localStorage
    const elVal = document.getElementById("kpiBalance");
    const elBtn = document.getElementById("toggleBalance");
    const elIcon = document.getElementById("toggleBalanceIcon");
    if (!elVal || !elBtn || !elIcon) return; // Không có phần tử -> bỏ qua

    // Hiển thị theo trạng thái
    function render(hidden) {
      const amount = Number(elVal.dataset.amount || 0);
      elVal.textContent = hidden ? "********" : Money.pretty(amount);
      elBtn.setAttribute("aria-pressed", (!hidden).toString());
      elIcon.className = hidden ? "bi bi-eye-slash fs-5" : "bi bi-eye fs-5";
    }

    // Trạng thái mặc định: ẩn
    const hidden0 = JSON.parse(localStorage.getItem(LS_KEY) ?? "true");
    render(hidden0);

    // Toggle khi click
    elBtn.addEventListener("click", () => {
      const cur = JSON.parse(localStorage.getItem(LS_KEY) ?? "true");
      const next = !cur;
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      render(next);
    });

    // [ADD] Hàm public để nơi khác cập nhật số dư thật sau khi fetch API
    // Ví dụ: BalanceEyeFeature.setAmount(2847500)
    window.BalanceEyeFeature = {
      setAmount(vndAmountNumber) {
        elVal.dataset.amount = Number(vndAmountNumber || 0);
        const h = JSON.parse(localStorage.getItem(LS_KEY) ?? "true");
        render(h);
      },
    };
  })();
})();
