import { getToken, getItem, setItem } from "./utils/storage.js";

// Cho phép cấu hình base từ template (web.py truyền vào)
const API_BASE = window.API_BASE || "";

function buildUrl(path) {
  if (!path) return API_BASE + "/api";
  if (/^https?:\/\//i.test(path)) return path; // absolute
  if (path.startsWith("/api/")) return API_BASE + path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE + "/api" + normalized;
}

/**
 * Gọi API JSON chung
 * @param {string} path - "/auth/login", "/auth/register", "/expenses", hoặc URL tuyệt đối
 * @param {string} method - GET/POST/PUT/PATCH/DELETE
 * @param {object|null} data - payload JSON (nếu có)
 * @param {object} options - có thể thêm headers bổ sung
 * @returns {Promise<object>} - dữ liệu JSON đã parse (hoặc throw Error)
 */
export async function apiCall(path, method = "GET", data = null, options = {}) {
  const url = buildUrl(path);
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  // Nếu gửi body JSON
  if (data !== null && data !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  // Gắn Authorization nếu có token
  const token = getToken?.();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const fetchOptions = {
    method,
    headers,
    body:
      data !== null && data !== undefined ? JSON.stringify(data) : undefined,
  };

  let res;
  try {
    res = await fetch(url, fetchOptions);
  } catch (err) {
    throw new Error(`Không gọi được API: ${err?.message || err}`);
  }

  // Đọc text trước rồi mới cố parse JSON để báo lỗi thân thiện
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (_) {
    // Trường hợp API trả HTML/error page
    if (!res.ok) {
      throw new Error(
        `API lỗi ${res.status}: ${text?.slice(0, 200) || res.statusText}`
      );
    }
    // Nếu 2xx mà không phải JSON -> coi như rỗng
    return {};
  }

  if (!res.ok || json?.success === false) {
    // Ưu tiên message từ backend
    const msg =
      json?.message || json?.error || res.statusText || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  // Nếu backend trả refresh_token, có thể lưu lại (tùy bạn dùng)
  if (json.refresh_token) {
    setItem("refresh_token", json.refresh_token); // dùng utils/storage.js sẵn có
  }

  return json;
}
