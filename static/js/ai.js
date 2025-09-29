// ai.js - AI features: classify, score, forecast
import { apiCall } from './api.js';
import { showToast } from './app.js';
import { createLineChart } from './charts.js';

// Load AI Score
async function loadAIScore() {
  const scoreEl = document.getElementById('aiScore');
  if (!scoreEl) return;
  
  try {
    const data = await apiCall('/analytics/ai-score', 'GET');
    scoreEl.textContent = data.score;
    
    // Render score breakdown
    const breakdownEl = document.getElementById('scoreBreakdown');
    if (breakdownEl && data.breakdown) {
      breakdownEl.innerHTML = Object.entries(data.breakdown).map(([key, value]) => `
        <div class="mb-2">
          <div class="d-flex justify-content-between">
            <span>${key}</span>
            <span>${value}/100</span>
          </div>
          <div class="progress">
            <div class="progress-bar" style="width: ${value}%"></div>
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    scoreEl.textContent = '--';
    showToast('Không thể tải AI score', 'error');
  }
}

// Load AI Recommendations
async function loadRecommendations() {
  const recEl = document.getElementById('aiRecommendations');
  if (!recEl) return;
  
  try {
    const data = await apiCall('/analytics/recommendations', 'GET');
    recEl.innerHTML = `
      <ul class="list-group">
        ${data.recommendations.map(rec => `
          <li class="list-group-item">
            <strong>${rec.category}</strong>: ${rec.message}
            ${rec.priority === 'high' ? '<span class="badge bg-danger ms-2">Cao</span>' : ''}
          </li>
        `).join('')}
      </ul>
    `;
  } catch (error) {
    recEl.innerHTML = '<p class="text-muted">Không thể tải gợi ý</p>';
  }
}

// Load Forecast
async function loadForecast() {
  const forecastCanvas = document.getElementById('forecastChart');
  if (!forecastCanvas) return;
  
  try {
    const data = await apiCall('/analytics/forecast', 'GET');
    createLineChart(forecastCanvas, {
      labels: data.labels,
      datasets: [
        {
          label: 'Thực tế',
          data: data.actual,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
        },
        {
          label: 'Dự báo',
          data: data.forecast,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          borderDash: [5, 5],
        }
      ]
    });
  } catch (error) {
    showToast('Không thể tải dự báo', 'error');
  }
}

// Auto classify transaction
const classifyForm = document.getElementById('classifyForm');
if (classifyForm) {
  classifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = document.getElementById('transactionDescription').value;
    
    try {
      const result = await apiCall('/analytics/classify', 'POST', { description });
      const resultEl = document.getElementById('classifyResult');
      resultEl.innerHTML = `
        <div class="alert alert-success">
          <strong>Danh mục gợi ý:</strong> ${result.category}
          <br>
          <strong>Độ tin cậy:</strong> ${(result.confidence * 100).toFixed(1)}%
        </div>
      `;
    } catch (error) {
      showToast('Không thể phân loại', 'error');
    }
  });
}

// Initialize
if (document.getElementById('aiScore')) {
  loadAIScore();
  loadRecommendations();
  loadForecast();
}
