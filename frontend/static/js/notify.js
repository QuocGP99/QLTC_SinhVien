// static/js/notify.js
// =======================================
// ⚙️ Thông báo ngân sách tháng (BudgetNotify)
// Tự động đồng bộ với API backend Quốc:
//    GET /api/budgets/summary?month=YYYY-MM
// ---------------------------------------
// Lưu localStorage["budget_data"] = [{category, limit, spent}]
// và hiển thị cảnh báo (vàng / đỏ / vượt ngân sách).
// =======================================

const BudgetNotify = (() => {
  const STORAGE_KEY = "budget_notis_read";
  const qs = (s, r = document) => r.querySelector(s);
  const money = (n) => (Number(n) || 0).toLocaleString("vi-VN") + " đ";
  const monthLabel = (d = new Date()) => {
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${m}/${d.getFullYear()}`;
  };

  const loadReadMap = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  };
  const saveReadMap = (map) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {}
  };

  // 🧩 Gọi API backend để đồng bộ dữ liệu ngân sách
  async function syncFromAPI() {
    const now = new Date();
    const month = now.toISOString().slice(0, 7); // "YYYY-MM"

    try {
      const res = await fetch(
        `${BASE_API_URL}/api/budgets/summary?month=${month}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(localStorage.getItem("token")
              ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
              : {}),
          },
          credentials: "include", // nếu backend dùng cookie JWT
        }
      );

      if (!res.ok) throw new Error("Không thể tải dữ liệu ngân sách");
      const payload = await res.json();

      // Đảm bảo đúng cấu trúc backend Quốc trả về
      const items = payload?.data?.items || [];

      // Map về format notify.js cần
      const mapped = items.map((it) => ({
        category: it.category ?? "",
        limit: Number(it.amount ?? it.limit ?? 0),
        spent: Number(it.spent ?? it.used ?? 0),
      }));

      localStorage.setItem("budget_data", JSON.stringify(mapped));
    } catch (err) {
      console.error("[BudgetNotify] Lỗi đồng bộ dữ liệu:", err);
      localStorage.setItem("budget_data", "[]");
    }
  }

  // 🧠 Render thông báo ra giao diện
  function render() {
    const list = qs("#notiList");
    const badge = qs("#notiBadge");
    const monthEl = qs("#notiMonth");
    if (!list || !badge) return;

    const stored = JSON.parse(localStorage.getItem("budget_data") || "[]");
    const readMap = loadReadMap();
    const notis = [];
    const thang = monthLabel();

    stored.forEach((b) => {
      const limit = Math.max(1, Number(b.limit) || 0);
      const spent = Number(b.spent) || 0;
      const pct = Math.round((spent / limit) * 100);
      const remain = limit - spent;
      let level = null,
        msg = null;

      if (pct >= 100) {
        const overBy = pct - 100;
        level = "over";
        msg = `Bạn đã dùng quá ${overBy}% (${money(
          Math.abs(remain)
        )}) ngân sách cho mục ${b.category} trong tháng ${thang}.`;
      } else if (pct >= 90) {
        level = "red";
        msg = `⚠️ Cảnh báo đỏ: Mục ${b.category} chỉ còn ${money(
          remain
        )} trong ngân sách tháng ${thang}.`;
      } else if (pct >= 80) {
        const leftPct = 100 - pct;
        level = "yellow";
        msg = `⚠️ Cảnh báo vàng: Bạn chỉ còn ${leftPct}% (~${money(
          remain
        )}) cho mục ${b.category} trong tháng ${thang}.`;
      }

      if (level) {
        const id = `${b.category}|${level}|${thang}`;
        notis.push({ id, level, msg, pct, read: !!readMap[id] });
      }
    });

    // 🧾 render danh sách
    list.innerHTML = "";
    const unread = notis.filter((n) => !n.read).length;
    if (monthEl) monthEl.textContent = thang;

    if (unread === 0) {
      list.innerHTML = `<div class="text-muted small px-3 py-2">Chưa có thông báo.</div>`;
      badge.classList.add("d-none");
    } else {
      badge.textContent = unread;
      badge.classList.remove("d-none");
    }

    notis.forEach((n) => {
      const dotClass = n.read
        ? "dot-grey"
        : n.level === "yellow"
        ? "dot-yellow"
        : n.level === "red"
        ? "dot-red"
        : "dot-black";

      const unreadBg = n.read
        ? "noti-read"
        : n.level === "yellow"
        ? "noti-unread-yellow"
        : n.level === "red"
        ? "noti-unread-red"
        : "noti-unread-over";

      const title =
        n.level === "yellow"
          ? "Cảnh báo vàng"
          : n.level === "red"
          ? "Cảnh báo đỏ"
          : "Quá ngân sách";

      const item = document.createElement("div");
      item.className = `noti-item ${unreadBg}`;
      item.dataset.id = n.id;
      item.innerHTML = `
        <div class="noti-dot ${dotClass}"></div>
        <div>
          <div class="fw-semibold small">${title} • ${n.pct}%</div>
          <div class="small">${n.msg}</div>
        </div>
      `;
      list.appendChild(item);
    });

    // click để đánh dấu đã đọc
    list.onclick = (e) => {
      const el = e.target.closest(".noti-item");
      if (!el) return;
      const id = el.dataset.id;
      const map = loadReadMap();
      map[id] = true;
      saveReadMap(map);
      render();
    };
  }

  // 🌐 Public API
  async function init() {
    await syncFromAPI();
    render();
  }

  return { init, render };
})();

// ============================
// ✅ Cách dùng (gọi 1 lần khi load trang):
// document.addEventListener('DOMContentLoaded', () => {
//   BudgetNotify.init();
// });
