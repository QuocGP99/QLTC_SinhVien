// api.js — Wrapper gọi REST API tới Backend

function getBaseApi() {
  if (typeof window !== "undefined") {
    const v = (window.BASE_API_URL ?? "").toString().trim();
    if (v) return v;
  }
  const meta = document.querySelector('meta[name="base-api-url"]');
  const m = (meta?.content ?? "").toString().trim();
  return m || "/api";
}
const BASE = getBaseApi().replace(/\/+$/, "");

function joinPath(base, path) {
  if (!path) return base || "";
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base || ""}${p}`;
}

/**
 * apiCall(path, method, body, opts)
 * @param {string} path - '/analytics/transactions'
 * @param {string} method - GET|POST|PUT|PATCH|DELETE
 * @param {object|null} body - payload JSON
 * @param {object} opts - { params, headers, raw, signal }
 */
export async function apiCall(path, method = "GET", body = null, opts = {}) {
  const { params, headers = {}, raw = false, signal } = opts;

  const full = joinPath(BASE, path);
  const url = new URL(full, window.location?.origin || undefined);
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "")
        url.searchParams.append(k, v);
    });
  }

  const h = new Headers(headers);
  // gắn token nếu có
  try {
    const token = localStorage.getItem("access_token");
    if (token && !h.has("Authorization"))
      h.set("Authorization", `Bearer ${token}`);
  } catch (_) {}
  const hasBody = body !== null && body !== undefined && method !== "GET";
  if (hasBody && !h.has("Content-Type"))
    h.set("Content-Type", "application/json");

  const res = await fetch(url.toString(), {
    method,
    headers: h,
    body: hasBody ? JSON.stringify(body) : undefined,
    credentials: "include",
    signal,
  });

  if (raw) return res;

  const txt = await res.text();
  let data;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch {
    data = txt;
  }

  if (!res.ok) {
    const message =
      (data && (data.detail || data.message || data.error)) ||
      `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    err.url = url.toString();
    throw err;
  }
  return data;
}

// Các alias nhanh thường dùng trong dự án
export const Api = {
  // danh mục & giao dịch
  getCategories: (params) => apiCall("/categories", "GET", null, { params }),
  getTransactions: (params) =>
    apiCall("/transactions", "GET", null, { params }),
  createTransaction: (payload) => apiCall("/transactions", "POST", payload),
  updateTransaction: (id, payload) =>
    apiCall(`/transactions/${id}`, "PUT", payload),
  deleteTransaction: (id) => apiCall(`/transactions/${id}`, "DELETE"),

  // analytics dùng cho trang phân tích
  getAnalyticsTransactions: (params) =>
    apiCall("/analytics/transactions", "GET", null, { params }),
  getAISummary: (params) =>
    apiCall("/analytics/ai-summary", "GET", null, { params }),
  getSavingsTrend: (params) =>
    apiCall("/analytics/savings-trend", "GET", null, { params }),
};

export { BASE as BASE_API_URL };
