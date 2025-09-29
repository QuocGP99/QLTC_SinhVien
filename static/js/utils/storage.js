// storage.js - LocalStorage utilities

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';
const FEATURE_FLAGS_KEY = 'feature_flags';
const THEME_KEY = 'theme';

// Token management
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// User data management
export function getUser() {
  const userData = localStorage.getItem(USER_KEY);
  return userData ? JSON.parse(userData) : null;
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeUser() {
  localStorage.removeItem(USER_KEY);
}

// Feature flags
export function getFeatureFlags() {
  const flags = localStorage.getItem(FEATURE_FLAGS_KEY);
  return flags ? JSON.parse(flags) : [];
}

export function setFeatureFlags(flags) {
  localStorage.setItem(FEATURE_FLAGS_KEY, JSON.stringify(flags));
}

export function hasFeature(featureName) {
  const flags = getFeatureFlags();
  return flags.includes(featureName);
}

// Theme management
export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

// Generic storage functions
export function getItem(key, defaultValue = null) {
  const item = localStorage.getItem(key);
  if (!item) return defaultValue;
  
  try {
    return JSON.parse(item);
  } catch {
    return item;
  }
}

export function setItem(key, value) {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  localStorage.setItem(key, stringValue);
}

export function removeItem(key) {
  localStorage.removeItem(key);
}

export function clear() {
  localStorage.clear();
}

// Session storage equivalents
export const session = {
  getItem: (key, defaultValue = null) => {
    const item = sessionStorage.getItem(key);
    if (!item) return defaultValue;
    
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  },
  
  setItem: (key, value) => {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    sessionStorage.setItem(key, stringValue);
  },
  
  removeItem: (key) => {
    sessionStorage.removeItem(key);
  },
  
  clear: () => {
    sessionStorage.clear();
  }
};
