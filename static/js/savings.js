// savings.js - Savings goals management
import { apiCall } from './api.js';
import { showToast } from './app.js';
import { formatCurrency, formatPercent, formatDate } from './utils/format.js';

let savings = [];

// Load savings
async function loadSavings() {
  try {
    savings = await apiCall('/savings', 'GET');
    renderSavings();
    updateSummary();
  } catch (error) {
    showToast('Không thể tải mục tiêu tiết kiệm', 'error');
  }
}

// Render savings
function renderSavings() {
  const savingsList = document.getElementById('savingsList');
  if (!savingsList) return;
  
  savingsList.innerHTML = savings.map(saving => {
    const percent = (saving.current_amount / saving.target_amount) * 100;
    const progressClass = percent >= 100 ? 'bg-success' : percent >= 50 ? 'bg-info' : 'bg-warning';
    
    return `
      <div class="col-md-6 mb-3">
        <div class="card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h5>${saving.name}</h5>
              <div>
                <button class="btn btn-sm btn-outline-success" onclick="addContribution(${saving.id})">
                  <i class="bi bi-plus"></i> Đóng góp
                </button>
                <button class="btn btn-sm btn-outline-primary" onclick="editSaving(${saving.id})">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteSaving(${saving.id})">
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
              <span>${formatCurrency(saving.current_amount)} / ${formatCurrency(saving.target_amount)}</span>
              ${saving.deadline ? `<span class="text-muted">Hạn: ${formatDate(saving.deadline)}</span>` : ''}
            </div>
            ${saving.description ? `<p class="text-muted mt-2 mb-0">${saving.description}</p>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Update summary
function updateSummary() {
  const totalGoals = savings.length;
  const totalSaved = savings.reduce((sum, s) => sum + s.current_amount, 0);
  const totalTarget = savings.reduce((sum, s) => sum + s.target_amount, 0);
  
  document.getElementById('totalGoals').textContent = totalGoals;
  document.getElementById('totalSaved').textContent = formatCurrency(totalSaved);
  document.getElementById('totalTarget').textContent = formatCurrency(totalTarget);
}

// Add saving button
const addSavingBtn = document.getElementById('addSavingBtn');
if (addSavingBtn) {
  addSavingBtn.addEventListener('click', () => {
    showToast('Feature coming soon', 'info');
  });
}

// Initialize
if (document.getElementById('savingsList')) {
  loadSavings();
}

// Export functions
window.addContribution = (id) => {
  showToast('Contribution feature coming soon', 'info');
};

window.editSaving = (id) => {
  showToast('Edit feature coming soon', 'info');
};

window.deleteSaving = async (id) => {
  if (confirm('Bạn có chắc muốn xóa mục tiêu này?')) {
    try {
      await apiCall(`/savings/${id}`, 'DELETE');
      showToast('Đã xóa mục tiêu', 'success');
      loadSavings();
    } catch (error) {
      showToast('Không thể xóa mục tiêu', 'error');
    }
  }
};
