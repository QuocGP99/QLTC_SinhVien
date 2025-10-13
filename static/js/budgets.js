// static/js/budgets.js
const BudgetPage = (() => {
  let modalInstance = null;

  // Demo: danh mục có sẵn (hoặc lấy từ BE)
  const categories = [
    'Ăn uống', 'Di chuyển', 'Giải trí', 'Mua sắm', 'Học tập', 'Sức khỏe', 'Nhà ở'
  ];

  function qs(sel, root = document) { return root.querySelector(sel); }
  function money(n) { 
    return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
  }

  function openModal() {
    const el = qs('#budgetModal');
    if (!modalInstance) modalInstance = new bootstrap.Modal(el);
    // reset form
    qs('#budgetForm').reset();
    qs('#budgetModalTitle').textContent = 'Thêm danh mục ngân sách';
    // fill options
    const sel = qs('#budgetCategory');
    sel.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    modalInstance.show();
  }

  function closeModal() {
    if (modalInstance) modalInstance.hide();
  }

  function onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      category: form.category.value.trim(),
      amount: Number(form.amount.value || 0)
    };
    if (!data.category || !data.amount) return;

    // Ở đây bạn gọi API BE (POST /budget) thay cho console.log
    console.log('Gửi ngân sách mới:', data);

    // Demo: hiển thị toast/alert nhẹ
    if (window.appToast) {
      appToast('Đã thêm ngân sách cho ' + data.category + ' (' + money(data.amount) + ')');
    } else {
      alert('Đã thêm ngân sách cho ' + data.category);
    }

    closeModal();

    // Sau khi BE trả OK, nên reload lại danh sách: fetchBudgetList();
  }

  function bindEvents() {
    // Nút mở modal
    qs('#btnAddBudget')?.addEventListener('click', openModal);
    // Submit form
    qs('#budgetForm')?.addEventListener('submit', onSubmit);
  }

  // (Tuỳ chọn) mock show dữ liệu tổng/tiến độ
  function loadDemoKPI() {
    // ví dụ: điền số 1.100.000 / 990.000 / 110.000
    // nếu bạn đã render bằng Jinja thì bỏ đoạn này
    // ...
  }

  function init() {
    bindEvents();
    loadDemoKPI();
  }

  return { init };
})();
