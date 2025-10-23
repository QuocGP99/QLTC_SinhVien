// app.js — Các tiện ích UI/UX dùng chung

/**
 * Hiển thị thông báo kiểu Toast (Bootstrap 5 nếu có, fallback alert)
 * @param {string} msg
 * @param {'success'|'error'|'info'|'warning'} type
 */
export function showToast(msg, type = 'info') {
  const typeMap = {
    success: { bg: 'bg-success text-white', icon: 'bi-check-circle' },
    error:   { bg: 'bg-danger text-white',  icon: 'bi-exclamation-triangle' },
    warning: { bg: 'bg-warning',           icon: 'bi-exclamation-circle' },
    info:    { bg: 'bg-primary text-white', icon: 'bi-info-circle' }
  };
  const t = typeMap[type] || typeMap.info;

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1080';
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = `toast align-items-center ${t.bg}`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.setAttribute('aria-atomic', 'true');
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="bi ${t.icon}"></i>
        <span>${escapeHtml(String(msg))}</span>
      </div>
      <button type="button" class="btn-close ${t.bg.includes('text-white') ? 'btn-close-white' : ''} me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  container.appendChild(el);

  const hasBootstrap = !!window.bootstrap?.Toast;
  if (hasBootstrap) {
    const toast = new window.bootstrap.Toast(el, { delay: 3200 });
    toast.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
  } else {
    alert(msg);
    el.remove();
  }
}

// ====== Helpers nhỏ ======
export function escapeHtml(s) {
  return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
          .replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

export function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}

// Định dạng VND nhanh (nếu bạn không muốn import format.js ở vài chỗ)
export function toVND(n) {
  return (Number(n) || 0).toLocaleString('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0
  });
}
