// static/js/notify.js
// =======================================
// ⚙️ Thông báo ngân sách tháng (BudgetNotify)
// API backend Quốc (ví dụ):
//    GET {BASE_API_URL}/budgets/summary?month=YYYY-MM
// ---------------------------------------
// - Lưu localStorage["budget_data"] = [{category, limit, spent}]
// - Tạo thông báo khi mức dùng đạt: ≥80% (vàng), ≥90% (đỏ), >100% (quá ngân sách)
// - Thông báo mới sẽ nằm TRÊN CÙNG: sort Unread → Severity → Newest
// - Ghi nhận thời điểm xuất hiện (firstSeen) vào budget_notis_meta để ổn định thứ tự
// =======================================

const BudgetNotify = (() => {
  const STORAGE_READ = "budget_notis_read";
  const STORAGE_META = "budget_notis_meta"; // { [id]: { firstSeen: ISOString } }
  const qs = (s, r = document) => r.querySelector(s);
  const money = (n) => (Number(n) || 0).toLocaleString("vi-VN") + " đ";
  const monthLabel = (d = new Date()) => {
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${m}/${d.getFullYear()}`;
  };
  const isoMonth = (d = new Date()) => d.toISOString().slice(0, 7); // "YYYY-MM"

  const loadJSON = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  };
  const saveJSON = (key, val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  };

  // 🧩 Gọi API backend để đồng bộ dữ liệu ngân sách
  async function syncFromAPI() {
    const month = isoMonth();
    const url = `${window.BASE_API_URL.replace(
      /\/$/,
      ""
    )}/budgets/summary?month=${month}`;

    try {
      const token =
        localStorage.getItem("access_token") || localStorage.getItem("token"); // tuỳ app dùng key nào
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include", // nếu backend dùng cookie JWT
      });

      if (!res.ok)
        throw new Error(`Không thể tải dữ liệu ngân sách (${res.status})`);
      const payload = await res.json();

      // Backend Quốc nên trả về kiểu:
      // { data: { items: [{ category, limit/amount, spent/used, updated_at? }] } }
      const items = payload?.data?.items || [];

      // Map về format notify.js cần
      const mapped = items.map((it) => ({
        category: it.category ?? "",
        limit: Number(it.limit ?? it.amount ?? 0),
        spent: Number(it.spent ?? it.used ?? 0),
        // nếu BE có updated_at/mtime thì tận dụng, else fallback now
        updated_at: it.updated_at || it.mtime || new Date().toISOString(),
      }));

      saveJSON("budget_data", mapped);
    } catch (err) {
      console.error("[BudgetNotify] Lỗi đồng bộ dữ liệu:", err);
      saveJSON("budget_data", []);
    }
  }

  // 🧠 Sinh danh sách thông báo từ budget_data
  function buildNotifications() {
    const stored = loadJSON("budget_data", []);
    const readMap = loadJSON(STORAGE_READ, {});
    const metaMap = loadJSON(STORAGE_META, {}); // để lưu firstSeen

    const notis = [];
    const thang = monthLabel();

    stored.forEach((b) => {
      const limit = Math.max(1, Number(b.limit) || 0);
      const spent = Number(b.spent) || 0;
      const pct = Math.round((spent / limit) * 100);
      const remain = limit - spent;

      let level = null;
      let title = "";
      let msg = "";

      if (pct > 100) {
        const overBy = pct - 100;
        level = "over";
        title = "Quá ngân sách";
        msg = `Bạn đã dùng quá ${overBy}% (${money(
          Math.abs(remain)
        )}) ngân sách cho mục ${b.category} trong tháng ${thang}.`;
      } else if (pct >= 90) {
        level = "red";
        title = "Cảnh báo đỏ";
        msg = `⚠️ ${title}: Mục ${b.category} chỉ còn ${money(
          remain
        )} trong ngân sách tháng ${thang}.`;
      } else if (pct >= 80) {
        level = "yellow";
        title = "Cảnh báo vàng";
        const leftPct = 100 - pct;
        msg = `⚠️ ${title}: Bạn chỉ còn ${leftPct}% (~${money(
          remain
        )}) cho mục ${b.category} trong tháng ${thang}.`;
      }

      if (level) {
        // id ổn định theo (category|level|YYYY-MM)
        const id = `${b.category}|${level}|${isoMonth()}`;

        // gắn firstSeen một lần để sort "mới nhất" ổn định
        if (!metaMap[id]) {
          metaMap[id] = {
            firstSeen: b.updated_at || new Date().toISOString(),
          };
        }

        notis.push({
          id,
          level,
          title,
          msg,
          pct,
          read: !!readMap[id],
          firstSeen: metaMap[id].firstSeen,
        });
      }
    });

    // lưu lại meta nếu có id mới phát sinh
    saveJSON(STORAGE_META, metaMap);
    return notis;
  }

  // 📊 Thang mức độ để sort: over > red > yellow
  const severityWeight = { over: 3, red: 2, yellow: 1 };

  // 🧾 Render ra DOM
  function render() {
    const list = qs("#notiList");
    const badge = qs("#notiBadge");
    const monthEl = qs("#notiMonth");
    if (!list || !badge) return;

    const notis = buildNotifications();

    // Sort: Unread first → severity desc → firstSeen desc
    notis.sort((a, b) => {
      const timeDiff = new Date(b.firstSeen) - new Date(a.firstSeen);
      if (timeDiff !== 0) return timeDiff;
      return (severityWeight[b.level] || 0) - (severityWeight[a.level] || 0);
    });

    const unread = notis.filter((n) => !n.read).length;
    if (monthEl) monthEl.textContent = monthLabel();

    // Badge & list
    list.innerHTML = "";
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

      const item = document.createElement("div");
      item.className = `noti-item ${unreadBg}`;
      item.dataset.id = n.id;
      item.innerHTML = `
        <div class="noti-dot ${dotClass}"></div>
        <div>
          <div class="fw-semibold small">${n.title} • ${n.pct}%</div>
          <div class="small">${n.msg}</div>
          <div class="small text-muted">${new Date(n.firstSeen).toLocaleString(
            "vi-VN"
          )}</div>
        </div>
      `;
      list.appendChild(item);
    });

    // Click để đánh dấu đã đọc
    list.onclick = (e) => {
      const el = e.target.closest(".noti-item");
      if (!el) return;
      const id = el.dataset.id;
      const readMap = loadJSON(STORAGE_READ, {});
      readMap[id] = true;
      saveJSON(STORAGE_READ, readMap);
      render();
    };
  }

  // Public API
  async function refresh({ sync = true } = {}) {
    if (sync) await syncFromAPI();
    render();
  }

  async function init() {
    await syncFromAPI();
    render();
    // lắng nghe sự kiện khi chi tiêu thay đổi từ các module khác
    window.addEventListener("budget:changed", () => refresh({ sync: true }));
    window.addEventListener("expenses:changed", () => refresh({ sync: true }));
    window.addEventListener("transactions:saved", () =>
      refresh({ sync: true })
    );

    // đồng bộ khi localStorage 'budget_data' bị thay ở tab khác
    window.addEventListener("storage", (e) => {
      if (e.key === "budget_data") render();
    });
  }

  return { init, render, refresh };
})();
