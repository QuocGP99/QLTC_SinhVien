// admin.js - Admin panel functionality
import { apiCall } from './api.js';
import { showToast } from './app.js';
import { formatCurrency, formatDate } from './utils/format.js';

// ===== USERS MANAGEMENT =====
async function loadUsers() {
  try {
    const users = await apiCall('/admin/users', 'GET');
    renderUsersTable(users);
    updateUserStats(users);
  } catch (error) {
    showToast('Không thể tải danh sách users', 'error');
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = users.map(user => `
    <tr>
      <td>${user.id}</td>
      <td>${user.email}</td>
      <td>${user.full_name || '-'}</td>
      <td><span class="badge bg-${user.role === 'admin' ? 'danger' : 'primary'}">${user.role}</span></td>
      <td><span class="badge bg-${user.is_active ? 'success' : 'secondary'}">${user.is_active ? 'Active' : 'Locked'}</span></td>
      <td>${formatDate(user.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-outline-warning" onclick="toggleUserLock(${user.id}, ${user.is_active})">
          <i class="bi bi-${user.is_active ? 'lock' : 'unlock'}"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${user.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function updateUserStats(users) {
  document.getElementById('totalUsers').textContent = users.length;
  document.getElementById('activeUsers').textContent = users.filter(u => u.is_active).length;
  document.getElementById('lockedUsers').textContent = users.filter(u => !u.is_active).length;
  document.getElementById('adminUsers').textContent = users.filter(u => u.role === 'admin').length;
}

// ===== TRANSACTIONS MANAGEMENT =====
async function loadTransactions() {
  try {
    const transactions = await apiCall('/admin/transactions', 'GET');
    renderTransactionsTable(transactions);
    updateTransactionStats(transactions);
  } catch (error) {
    showToast('Không thể tải giao dịch', 'error');
  }
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('transactionsTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = transactions.map(tx => `
    <tr>
      <td>${tx.id}</td>
      <td>${tx.user_email}</td>
      <td><span class="badge bg-${tx.type === 'expense' ? 'danger' : 'success'}">${tx.type}</span></td>
      <td>${formatCurrency(tx.amount)}</td>
      <td>${tx.category}</td>
      <td>${formatDate(tx.date)}</td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction(${tx.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function updateTransactionStats(transactions) {
  document.getElementById('totalTransactions').textContent = transactions.length;
  const totalValue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  document.getElementById('totalValue').textContent = formatCurrency(totalValue);
  
  const today = new Date().toISOString().split('T')[0];
  const todayCount = transactions.filter(tx => tx.date.startsWith(today)).length;
  document.getElementById('todayTransactions').textContent = todayCount;
}

// ===== SYSTEM MANAGEMENT =====
async function loadSystemHealth() {
  try {
    const health = await apiCall('/admin/system/health', 'GET');
    document.getElementById('apiStatus').textContent = health.api_status;
    document.getElementById('dbStatus').textContent = health.db_status;
    document.getElementById('cacheStatus').textContent = health.cache_status;
    document.getElementById('uptime').textContent = health.uptime;
  } catch (error) {
    showToast('Không thể tải system health', 'error');
  }
}

async function loadFeatureFlags() {
  try {
    const flags = await apiCall('/admin/system/feature-flags', 'GET');
    const flagsEl = document.getElementById('featureFlags');
    if (flagsEl) {
      flagsEl.innerHTML = Object.entries(flags).map(([key, value]) => `
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="flag_${key}" 
                 ${value ? 'checked' : ''} onchange="toggleFeatureFlag('${key}', this.checked)">
          <label class="form-check-label" for="flag_${key}">${key}</label>
        </div>
      `).join('');
    }
  } catch (error) {
    showToast('Không thể tải feature flags', 'error');
  }
}

// Global functions
window.toggleUserLock = async (userId, isActive) => {
  try {
    await apiCall(`/admin/users/${userId}/toggle-lock`, 'POST');
    showToast(isActive ? 'Đã khóa user' : 'Đã mở khóa user', 'success');
    loadUsers();
  } catch (error) {
    showToast('Không thể thay đổi trạng thái', 'error');
  }
};

window.deleteUser = async (userId) => {
  if (confirm('Bạn có chắc muốn xóa user này?')) {
    try {
      await apiCall(`/admin/users/${userId}`, 'DELETE');
      showToast('Đã xóa user', 'success');
      loadUsers();
    } catch (error) {
      showToast('Không thể xóa user', 'error');
    }
  }
};

window.deleteTransaction = async (txId) => {
  if (confirm('Bạn có chắc muốn xóa giao dịch này?')) {
    try {
      await apiCall(`/admin/transactions/${txId}`, 'DELETE');
      showToast('Đã xóa giao dịch', 'success');
      loadTransactions();
    } catch (error) {
      showToast('Không thể xóa giao dịch', 'error');
    }
  }
};

window.toggleFeatureFlag = async (flag, enabled) => {
  try {
    await apiCall('/admin/system/feature-flags', 'POST', { flag, enabled });
    showToast(`Feature ${flag} đã ${enabled ? 'bật' : 'tắt'}`, 'success');
  } catch (error) {
    showToast('Không thể thay đổi feature flag', 'error');
  }
};

// Initialize based on page
if (document.getElementById('usersTable')) loadUsers();
if (document.getElementById('transactionsTable')) loadTransactions();
if (document.getElementById('apiStatus')) {
  loadSystemHealth();
  loadFeatureFlags();
}
