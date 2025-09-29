// budgets.js - Budget management
import { apiCall } from './api.js';
import { showToast } from './app.js';
import { formatCurrency, formatPercent } from './utils/format.js';

let budgets = [];

// Load budgets
async function loadBudgets() {
  try {
    budgets = await apiCall('/budgets', 'GET');
    renderBudgets();
    updateSummary();
  } catch (error) {
    showToast('Không thể tải ngân sách', 'error');
  }
}

// Render budgets
function renderBudgets() {
  const budgetList = document.getElementById('budgetList');
  if (!budgetList) return;
  
  budgetList.innerHTML = budgets.map(budget => {
    const percent = (budget.spent / budget.amount) * 100;
    const progressClass = percent > 80 ? 'bg-danger' : percent > 50 ? 'bg-warning' : 'bg-success';
    
    return `
      <div class="col-md-6 mb-3">
        <div class="card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h5>${budget.category}</h5>
              <div>
                <button class="btn btn-sm btn-outline-primary" onclick="editBudget(${budget.id})">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteBudget(${budget.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
            <div class="progress mb-2" style="height: 25px;">
              <div class="progress-bar ${progressClass}" role="progressbar" 
                   style="width: ${Math.min(percent, 100)}%">
                ${formatPercent(percent)}
              </div>
            </div>
            <div class="d-flex justify-content-between">
              <span>${formatCurrency(budget.spent)} / ${formatCurrency(budget.amount)}</span>
              <span class="text-muted">${budget.period}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Update summary
function updateSummary() {
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  
  document.getElementById('totalBudget').textContent = formatCurrency(totalBudget);
  document.getElementById('totalSpent').textContent = formatCurrency(totalSpent);
  document.getElementById('totalRemaining').textContent = formatCurrency(totalRemaining);
}

// Add budget button
const addBudgetBtn = document.getElementById('addBudgetBtn');
if (addBudgetBtn) {
  addBudgetBtn.addEventListener('click', () => {
    // Show modal (implement modal logic)
    showToast('Feature coming soon', 'info');
  });
}

// Initialize
if (document.getElementById('budgetList')) {
  loadBudgets();
}

// Export functions for global access
window.editBudget = (id) => {
  showToast('Edit feature coming soon', 'info');
};

window.deleteBudget = async (id) => {
  if (confirm('Bạn có chắc muốn xóa ngân sách này?')) {
    try {
      await apiCall(`/budgets/${id}`, 'DELETE');
      showToast('Đã xóa ngân sách', 'success');
      loadBudgets();
    } catch (error) {
      showToast('Không thể xóa ngân sách', 'error');
    }
  }
};
