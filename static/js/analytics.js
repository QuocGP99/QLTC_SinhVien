// analytics.js - Financial analytics and insights
import { apiCall } from './api.js';
import { showToast } from './app.js';
import { formatCurrency, formatPercent } from './utils/format.js';
import { createLineChart, createPieChart } from './charts.js';

let analyticsData = null;

// Load analytics data
async function loadAnalytics() {
  try {
    analyticsData = await apiCall('/analytics/summary', 'GET');
    updateSummary();
    renderCharts();
  } catch (error) {
    showToast('Không thể tải dữ liệu phân tích', 'error');
  }
}

// Update summary cards
function updateSummary() {
  if (!analyticsData) return;
  
  document.getElementById('totalIncome').textContent = formatCurrency(analyticsData.total_income || 0);
  document.getElementById('totalExpenses').textContent = formatCurrency(analyticsData.total_expenses || 0);
  document.getElementById('totalSavings').textContent = formatCurrency(analyticsData.total_savings || 0);
  
  const savingsRate = analyticsData.total_income > 0 
    ? (analyticsData.total_savings / analyticsData.total_income) * 100 
    : 0;
  document.getElementById('savingsRate').textContent = formatPercent(savingsRate);
}

// Render charts
function renderCharts() {
  if (!analyticsData) return;
  
  // Spending trend chart
  const trendCanvas = document.getElementById('spendingTrendChart');
  if (trendCanvas && analyticsData.spending_trend) {
    createLineChart(trendCanvas, {
      labels: analyticsData.spending_trend.labels,
      datasets: [{
        label: 'Chi tiêu',
        data: analyticsData.spending_trend.data,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
      }]
    });
  }
  
  // Category breakdown chart
  const categoryCanvas = document.getElementById('categoryBreakdownChart');
  if (categoryCanvas && analyticsData.category_breakdown) {
    createPieChart(categoryCanvas, {
      labels: analyticsData.category_breakdown.labels,
      datasets: [{
        data: analyticsData.category_breakdown.data,
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ]
      }]
    });
  }
}

// Load AI insights if feature enabled
async function loadAIInsights() {
  const aiInsightsEl = document.getElementById('aiInsights');
  if (!aiInsightsEl) return;
  
  try {
    const insights = await apiCall('/analytics/ai-insights', 'GET');
    aiInsightsEl.innerHTML = `
      <div class="alert alert-info">
        <h6>💡 Gợi ý từ AI:</h6>
        <ul>
          ${insights.recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    `;
  } catch (error) {
    aiInsightsEl.innerHTML = '<p class="text-muted">Không thể tải AI insights</p>';
  }
}

// Initialize
if (document.getElementById('totalIncome')) {
  loadAnalytics();
  loadAIInsights();
}
