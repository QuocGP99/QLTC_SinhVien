// auth.js - Handle login, register, forgot, reset
import { apiCall } from './api.js';
import { showToast } from './app.js';
import { setToken, removeToken } from './utils/storage.js';

// Login
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const data = Object.fromEntries(formData);
    
    try {
      const response = await apiCall('/auth/login', 'POST', data);
      if (response.access_token) {
        setToken(response.access_token);
        showToast('Đăng nhập thành công!', 'success');
        window.location.href = '/';
      }
    } catch (error) {
      showToast(error.message || 'Đăng nhập thất bại', 'error');
    }
  });
}

// Register
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(registerForm);
    const data = Object.fromEntries(formData);
    
    if (data.password !== data.confirmPassword) {
      showToast('Mật khẩu không khớp', 'error');
      return;
    }
    
    try {
      await apiCall('/auth/register', 'POST', data);
      showToast('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
      window.location.href = '/login';
    } catch (error) {
      showToast(error.message || 'Đăng ký thất bại', 'error');
    }
  });
}

// Forgot Password
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(forgotForm);
    const data = Object.fromEntries(formData);
    
    try {
      await apiCall('/auth/forgot', 'POST', data);
      showToast('Link đặt lại mật khẩu đã được gửi đến email của bạn', 'success');
    } catch (error) {
      showToast(error.message || 'Gửi link thất bại', 'error');
    }
  });
}

// Reset Password
const resetForm = document.getElementById('resetForm');
if (resetForm) {
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(resetForm);
    const data = Object.fromEntries(formData);
    
    if (data.password !== data.confirmPassword) {
      showToast('Mật khẩu không khớp', 'error');
      return;
    }
    
    try {
      await apiCall('/auth/reset', 'POST', data);
      showToast('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.', 'success');
      window.location.href = '/login';
    } catch (error) {
      showToast(error.message || 'Đặt lại mật khẩu thất bại', 'error');
    }
  });
}

// Logout
export function logout() {
  removeToken();
  showToast('Đã đăng xuất', 'info');
  window.location.href = '/login';
}
