(function () {
  // -------------------------
  // 1. Render demo data (giữ nguyên)
  // -------------------------
  const months = ["01", "02", "03", "04", "05"];
  const spend = [1450000, 1200000, 980000, 1500000, 1100000];

  const categories = [
    { name: "Ăn uống", value: 36, color: "#60a5fa" },
    { name: "Di chuyển", value: 22, color: "#34d399" },
    { name: "Giáo trình", value: 18, color: "#fbbf24" },
    { name: "Giải trí", value: 14, color: "#f472b6" },
    { name: "Nhà trọ", value: 10, color: "#94a3b8" },
  ];

  // const recent = [
  //   {
  //     desc: "Starbucks Coffee",
  //     date: "15/01",
  //     category: "Ăn uống",
  //     amount: 49500,
  //   },
  //   {
  //     desc: "Bus Pass Monthly",
  //     date: "14/01",
  //     category: "Di chuyển",
  //     amount: 750000,
  //   },
  //   {
  //     desc: "Physics Textbook",
  //     date: "13/01",
  //     category: "Giáo trình",
  //     amount: 899900,
  //   },
  // ];

  // const budgets = [
  //   { name: "Ăn uống", used: 450000, limit: 800000 },
  //   { name: "Di chuyển", used: 280000, limit: 400000 },
  //   { name: "Giáo trình", used: 200000, limit: 600000 },
  //   { name: "Giải trí", used: 180000, limit: 300000 },
  //   { name: "Nhà trọ", used: 144000, limit: 200000 },
  // ];

  const goals = [
    { name: "Laptop mới", current: 6500000, target: 15000000 },
    { name: "Học tiếng Anh", current: 1200000, target: 4000000 },
  ];

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
      // tx.type = "income" | "expense"
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
    // Ví dụ: 2025-10-27T12:00:00Z -> "27/10"
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  }

  // ===== Charts =====
  const ctxBar = document.getElementById("spendTrend");
  if (ctxBar && window.Chart) {
    new Chart(ctxBar, {
      type: "bar",
      data: {
        labels: months.map((m) => `Th ${m}`),
        datasets: [{ label: "Chi tiêu (₫)", data: spend }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
  }

  const ctxPie = document.getElementById("categoryPie");
  if (ctxPie && window.Chart) {
    new Chart(ctxPie, {
      type: "pie",
      data: {
        labels: categories.map((c) => c.name),
        datasets: [{ data: categories.map((c) => c.value) }],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    });
  }

  // ===== Bảng chi tiêu theo danh mục =====
  const tbl = document.getElementById("categoryTable");
  if (tbl) {
    categories.forEach((c, idx) => {
      const amtByCat = [450000, 280000, 200000, 180000, 144000][idx];
      tbl.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td class="text-nowrap">
            <span class="badge rounded-pill" style="background:${
              c.color
            };">&nbsp;</span>
            ${c.name}
          </td>
          <td class="text-end">₫${amtByCat.toLocaleString("vi-VN")}</td>
        </tr>`
      );
    });
  }

  // ===== Giao dịch gần đây =====
  async function loadRecentTransactions() {
    const recentList = document.getElementById("recentList");
    if (!recentList) return;

    recentList.innerHTML = `
      <div class="text-muted small fst-italic">Đang tải giao dịch gần đây...</div>
    `;

    // merge từ 2 API hiện có
    // /api/expenses?limit=5 và /api/incomes?limit=5 (bạn điều chỉnh đúng tham số backend của bạn)
    const [expRes, incRes] = await Promise.all([
      apiGet("/api/expenses", { limit: 5 }),
      apiGet("/api/incomes", { limit: 5 }),
    ]);

    // Giả định backend trả về { items: [...] }
    const expenses = (expRes.items || []).map((tx) => ({
      id: tx.id,
      type: "expense",
      desc: tx.description || tx.desc || tx.note || "(không mô tả)",
      category_name: tx.category || tx.category_name || "Chi tiêu",
      date: tx.date,
      amount: Number(tx.amount || 0),
    }));

    const incomes = (incRes.items || []).map((tx) => ({
      id: tx.id,
      type: "income",
      desc: tx.desc || tx.note || "(không mô tả)",
      category_name: tx.category || tx.category_name || "Thu nhập",
      date: tx.date,
      amount: Number(tx.amount || 0),
    }));

    // gộp rồi sort theo thời gian mới nhất
    const merged = [...expenses, ...incomes].sort((a, b) => {
      // sort desc theo ngày, fallback id
      const da = a.date || "";
      const db = b.date || "";
      if (db.localeCompare(da) !== 0) return db.localeCompare(da);
      return (b.id || 0) - (a.id || 0);
    });

    // chỉ lấy 5 giao dịch mới nhất
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
  }

  // gọi hàm sau khi DOM sẵn sàng trong file này (file IIFE chạy sau DOM vì script load cuối template)
  loadRecentTransactions();

  // ===== Tổng quan ngân sách trên dashboard =====
  async function loadBudgetOverview() {
    const monthLabelEl = document.getElementById("budgetMonthLabel");
    const usedVsLimitEl = document.getElementById("budgetUsedVsLimit");
    const percentUsedEl = document.getElementById("budgetPercentUsed");
    const progressBarEl = document.getElementById("budgetProgressBar");
    const budgetListEl = document.getElementById("budgetList");

    // Nếu layout không có block ngân sách (ví dụ mobile ẩn card) thì bỏ qua
    if (
      !monthLabelEl ||
      !usedVsLimitEl ||
      !percentUsedEl ||
      !progressBarEl ||
      !budgetListEl
    ) {
      return;
    }

    // Hiển thị trạng thái chờ
    budgetListEl.innerHTML = `
    <div class="text-muted small fst-italic">Đang tải ngân sách...</div>
  `;

    // Lấy tháng hiện tại => "YYYY-MM"
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const monthStr = `${yyyy}-${mm}`;

    // Cập nhật nhãn: "Ngân sách tháng 10/2025"
    monthLabelEl.textContent = `Ngân sách tháng ${mm}/${yyyy}`;

    // Gọi API summary ngân sách
    let resp;
    try {
      resp = await apiGet("/api/budgets/summary", { month: monthStr });
      // backend trả: { success: true, data: {...} }
    } catch (err) {
      console.error("Lỗi load ngân sách:", err);
      usedVsLimitEl.textContent = `${Money.pretty(0)} / ${Money.pretty(0)}`;
      percentUsedEl.textContent = `0% sử dụng`;
      progressBarEl.style.width = "0%";
      progressBarEl.className = "progress-bar bg-success";
      budgetListEl.innerHTML = `
      <div class="text-muted small fst-italic">Không tải được dữ liệu ngân sách</div>
    `;
      return;
    }

    if (!resp || !resp.success || !resp.data) {
      usedVsLimitEl.textContent = `${Money.pretty(0)} / ${Money.pretty(0)}`;
      percentUsedEl.textContent = `0% sử dụng`;
      progressBarEl.style.width = "0%";
      progressBarEl.className = "progress-bar bg-success";
      budgetListEl.innerHTML = `
      <div class="text-muted small fst-italic">Chưa có ngân sách cho tháng này</div>
    `;
      return;
    }

    const data = resp.data;

    const totalBudget = Number(data.total_budget || 0); // hạn mức tổng tháng
    const totalSpent = Number(data.total_spent || 0); // đã dùng
    // BE có thể gửi sẵn percent_used, nếu chưa có thì tự tính
    let totalPct = Number.isFinite(data.percent_used)
      ? Math.round(data.percent_used)
      : totalBudget
      ? Math.round((totalSpent * 100) / totalBudget)
      : 0;

    if (totalPct < 0) totalPct = 0;
    if (totalPct > 100) totalPct = 100;

    // Màu thanh tổng theo cùng quy tắc như trang budgets
    // pct < 70 => xanh, pct < 90 => vàng, còn lại => đỏ
    let totalBarClass = "bg-success";
    if (totalPct >= 90) {
      totalBarClass = "bg-danger";
    } else if (totalPct >= 70) {
      totalBarClass = "bg-warning";
    }

    // Gán dữ liệu tổng
    usedVsLimitEl.textContent = `${Money.pretty(totalSpent)} / ${Money.pretty(
      totalBudget
    )}`;
    percentUsedEl.textContent = `${totalPct}% đã dùng`;
    progressBarEl.className = `progress-bar ${totalBarClass}`;
    progressBarEl.style.width = `${totalPct}%`;

    // Danh sách danh mục
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      budgetListEl.innerHTML = `
      <div class="text-muted small fst-italic">Chưa có ngân sách danh mục</div>
    `;
      return;
    }

    // Clear danh sách cũ
    budgetListEl.innerHTML = "";

    items.forEach((it) => {
      // Backend của bạn trong budgets.summary đã dùng:
      // amount = hạn mức danh mục
      // spent  = đã dùng danh mục
      // percent_used = % đã dùng của danh mục
      const limit = Number(it.amount ?? it.limit ?? 0);
      const spent = Number(it.spent ?? it.used ?? 0);

      let pct = Number.isFinite(it.percent_used)
        ? Math.round(it.percent_used)
        : limit
        ? Math.min(100, Math.round((spent * 100) / limit))
        : 0;

      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;

      // chọn màu giống trang budgets
      // pct < 70 => xanh, pct < 90 => vàng, còn lại => đỏ
      let barCls = "bg-success";
      if (pct >= 90) {
        barCls = "bg-danger";
      } else if (pct >= 70) {
        barCls = "bg-warning";
      }

      // render dạng rút gọn cho dashboard: chỉ 2 dòng (tên + thanh)
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
  }

  loadBudgetOverview();

  // ===== Mục tiêu tiết kiệm (đọc API thật) =====
  async function loadSavingsOverview() {
    const listEl = document.getElementById("savingsGoals");
    const totalBarEl = document.getElementById("savingsTotalBar");
    const totalTextEl = document.getElementById("savingsTotalText");

    if (!listEl) return;

    // trạng thái đang tải
    listEl.innerHTML =
      '<div class="text-muted small fst-italic">Đang tải mục tiêu...</div>';

    // chuẩn bị header Authorization Bearer
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // gọi API /api/savings
    // backend savings.py -> list_goals() trả { items: [...] } với field:
    // id, name, description, category, priority, target_amount,
    // current_amount, monthly_contribution, deadline, status
    let data;
    try {
      const res = await fetch(API_BASE + "/api/savings", {
        headers,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      data = await safeJson(res);
    } catch (err) {
      console.error("Lỗi load savings:", err);
      listEl.innerHTML =
        '<div class="text-muted small fst-italic">Không tải được mục tiêu tiết kiệm</div>';
      if (totalBarEl) totalBarEl.style.width = "0%";
      if (totalTextEl) totalTextEl.textContent = "₫0 / ₫0";
      return;
    }

    const items = data.items || data || [];
    if (!items.length) {
      listEl.innerHTML =
        '<div class="text-muted small fst-italic">Chưa có mục tiêu tiết kiệm</div>';
      if (totalBarEl) totalBarEl.style.width = "0%";
      if (totalTextEl) totalTextEl.textContent = "₫0 / ₫0";
      return;
    }

    // tính tổng
    let totalCurrent = 0;
    let totalTarget = 0;
    items.forEach((g) => {
      totalCurrent += Number(g.current_amount || 0);
      totalTarget += Number(g.target_amount || 0);
    });

    // % tổng
    let totalPct = 0;
    if (totalTarget > 0) {
      totalPct = Math.round((totalCurrent * 100) / totalTarget);
      if (totalPct < 0) totalPct = 0;
      if (totalPct > 100) totalPct = 100;
    }

    // màu thanh tổng (giống ngân sách style cơ bản)
    let barCls = "bg-success";
    if (totalPct >= 90) {
      barCls = "bg-success"; // tiết kiệm cao là tốt -> luôn xanh
    }
    if (totalBarEl) {
      totalBarEl.className = "progress-bar " + barCls;
      totalBarEl.style.width = totalPct + "%";
    }
    if (totalTextEl) {
      totalTextEl.textContent = `${Money.pretty(totalCurrent)} / ${Money.pretty(
        totalTarget
      )}`;
    }

    // render từng goal rút gọn (tối đa 3 cái cho dashboard)
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

    // nếu có >3 mục tiêu thì thêm 1 dòng "Xem tất cả"
    if (items.length > 3) {
      listEl.insertAdjacentHTML(
        "beforeend",
        `
        <button
          class="btn btn-link p-0 small text-muted text-start"
          id="viewAllSavingsBtn"
          style="text-decoration:none"
        >
          Xem tất cả mục tiêu &rsaquo;
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
  }

  loadSavingsOverview();

  // -------------------------
  //  Quick actions on dashboard
  // -------------------------

  // NÚT 1: Thêm giao dịch -> hỏi loại -> xác nhận -> redirect
  const quickAddBtn = document.getElementById("quickAddBtn");

  // modal chọn loại giao dịch
  const chooseTypeEl = document.getElementById("chooseTypeModal");
  // modal xác nhận thêm giao dịch
  const confirmEl = document.getElementById("confirmAddModal");

  const chooseTypeModal =
    chooseTypeEl && window.bootstrap ? new bootstrap.Modal(chooseTypeEl) : null;

  const confirmModal =
    confirmEl && window.bootstrap ? new bootstrap.Modal(confirmEl) : null;

  // temporary state để nhớ người dùng chọn gì
  let pendingType = null; // "expense" | "income"

  // B1. Click "Thêm giao dịch"
  if (quickAddBtn && chooseTypeModal) {
    quickAddBtn.addEventListener("click", () => {
      pendingType = null;
      chooseTypeModal.show();
    });
  }

  // B2. Chọn "Chi tiêu"
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

  // B2'. Chọn "Thu nhập"
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

  // B3. Xác nhận OK / Không
  const btnYesConfirm = document.getElementById("btnYesConfirm");
  const btnNoConfirm = document.getElementById("btnNoConfirm");

  // Không -> hủy
  if (btnNoConfirm) {
    btnNoConfirm.addEventListener("click", () => {
      pendingType = null;
    });
  }

  // OK -> redirect sang trang tương ứng với query ?add=1
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

  // NÚT 2: Quản lý ngân sách -> đi thẳng sang trang ngân sách
  const quickBudgetPageBtn = document.getElementById("quickBudgetPageBtn");
  if (quickBudgetPageBtn) {
    quickBudgetPageBtn.addEventListener("click", () => {
      // đổi URL này thành route thực của trang ngân sách bạn đã có
      window.location.href = "/budgets";
    });
  }

  // NÚT bánh răng trong card "Tổng quan ngân sách"
  const openBudgetPageBtn = document.getElementById("openBudgetPageBtn");
  if (openBudgetPageBtn) {
    openBudgetPageBtn.addEventListener("click", () => {
      // điều hướng kèm scroll=categories để tự cuộn xuống "Danh mục ngân sách"
      window.location.href = "/budgets?scroll=categories";
    });
  }

  // NÚT 3: Đặt mục tiêu tiết kiệm -> mở confirmAddSavingModal -> OK -> redirect /savings?add=1
  const quickAddSavingBtn = document.getElementById("quickAddSavingBtn");
  const confirmAddSavingEl = document.getElementById("confirmAddSavingModal");

  if (quickAddSavingBtn && confirmAddSavingEl && window.bootstrap) {
    const confirmAddSavingModal = new bootstrap.Modal(confirmAddSavingEl);

    // Khi bấm "Đặt mục tiêu tiết kiệm", chỉ hiện modal xác nhận
    quickAddSavingBtn.addEventListener("click", () => {
      confirmAddSavingModal.show();
    });

    // Khi bấm OK trong modal xác nhận -> điều hướng tới /savings?add=1
    const btnYesAddSaving = document.getElementById("btnYesAddSaving");
    if (btnYesAddSaving) {
      btnYesAddSaving.addEventListener("click", () => {
        confirmAddSavingModal.hide();
        window.location.href = "/savings?add=1";
      });
    }
  }

  // ===== NÚT "Xem tất cả" giao dịch gần đây =====
  const viewAllBtn = document.getElementById("viewAllTransactionsBtn");
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", () => {
      // điều hướng đến trang giao dịch + tham số scroll
      window.location.href = "/transactions#recentSection";
    });
  }

  // NÚT "Xem chi tiết" mục tiêu tiết kiệm
  const dashViewSavingsBtn = document.getElementById("dashViewSavingsBtn");
  if (dashViewSavingsBtn) {
    dashViewSavingsBtn.addEventListener("click", () => {
      // thêm query để bên trang savings nhận biết và scroll
      window.location.href = "/savings?scroll=list";
    });
  }
})();
