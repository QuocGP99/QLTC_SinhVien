const TOKEN_KEY = "auth_token";
const USER_KEY = "user_data";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getUser() {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}
export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function removeUser() {
  localStorage.removeItem(USER_KEY);
}

export function setItem(k, v) {
  localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
}
export function getItem(k, d = null) {
  const x = localStorage.getItem(k);
  if (!x) return d;
  try {
    return JSON.parse(x);
  } catch {
    return x;
  }
}
const TOKEN_KEY = "auth_token";
const USER_KEY = "user_data";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getUser() {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}
export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function removeUser() {
  localStorage.removeItem(USER_KEY);
}

export function setItem(k, v) {
  localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
}
export function getItem(k, d = null) {
  const x = localStorage.getItem(k);
  if (!x) return d;
  try {
    return JSON.parse(x);
  } catch {
    return x;
  }
}
