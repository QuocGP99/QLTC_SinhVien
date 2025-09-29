// mock-data.js - Dữ liệu mẫu cho demo frontend (chưa kết nối backend)

// Mock expenses data
export const mockExpenses = [
  { id: 1, date: '2025-09-28', category: 'Ăn uống', description: 'Cơm trưa', amount: 50000 },
  { id: 2, date: '2025-09-27', category: 'Di chuyển', description: 'Xe bus', amount: 15000 },
  { id: 3, date: '2025-09-26', category: 'Giải trí', description: 'Xem phim', amount: 120000 },
  { id: 4, date: '2025-09-25', category: 'Ăn uống', description: 'Coffee', amount: 45000 },
  { id: 5, date: '2025-09-24', category: 'Mua sắm', description: 'Quần áo', amount: 350000 },
  { id: 6, date: '2025-09-23', category: 'Ăn uống', description: 'Nhà hàng', amount: 200000 },
  { id: 7, date: '2025-09-22', category: 'Di chuyển', description: 'Grab', amount: 85000 },
  { id: 8, date: '2025-09-21', category: 'Học tập', description: 'Sách', amount: 150000 },
  { id: 9, date: '2025-09-20', category: 'Ăn uống', description: 'Ăn sáng', amount: 35000 },
  { id: 10, date: '2025-09-19', category: 'Giải trí', description: 'Game', amount: 100000 },
  { id: 11, date: '2025-09-18', category: 'Ăn uống', description: 'Trà sữa', amount: 40000 },
  { id: 12, date: '2025-09-17', category: 'Sức khỏe', description: 'Khám bệnh', amount: 300000 },
  { id: 13, date: '2025-09-16', category: 'Di chuyển', description: 'Xăng xe', amount: 200000 },
  { id: 14, date: '2025-09-15', category: 'Ăn uống', description: 'Buffet', amount: 250000 },
  { id: 15, date: '2025-09-14', category: 'Mua sắm', description: 'Mỹ phẩm', amount: 180000 },
];

// Mock budgets data
export const mockBudgets = [
  { id: 1, category: 'Ăn uống', amount: 3000000, spent: 2150000, period: 'monthly' },
  { id: 2, category: 'Di chuyển', amount: 1000000, spent: 650000, period: 'monthly' },
  { id: 3, category: 'Giải trí', amount: 500000, spent: 420000, period: 'monthly' },
  { id: 4, category: 'Mua sắm', amount: 2000000, spent: 1530000, period: 'monthly' },
  { id: 5, category: 'Học tập', amount: 800000, spent: 450000, period: 'monthly' },
  { id: 6, category: 'Sức khỏe', amount: 1500000, spent: 600000, period: 'monthly' },
];

// Mock savings goals
export const mockSavings = [
  { 
    id: 1, 
    name: 'Mua laptop mới', 
    target_amount: 20000000, 
    current_amount: 12500000, 
    deadline: '2025-12-31',
    description: 'Laptop cho học tập và làm việc'
  },
  { 
    id: 2, 
    name: 'Du lịch Đà Lạt', 
    target_amount: 5000000, 
    current_amount: 3200000, 
    deadline: '2025-11-15',
    description: 'Chuyến đi cuối năm'
  },
  { 
    id: 3, 
    name: 'Quỹ khẩn cấp', 
    target_amount: 10000000, 
    current_amount: 4500000, 
    deadline: null,
    description: 'Dự phòng cho tình huống khẩn cấp'
  },
];

// Mock categories
export const mockCategories = [
  'Ăn uống',
  'Di chuyển',
  'Giải trí',
  'Mua sắm',
  'Học tập',
  'Sức khỏe',
  'Hóa đơn',
  'Khác'
];

// Mock dashboard summary
export const mockDashboardSummary = {
  total_income: 15000000,
  total_expenses: 6000000,
  total_budget: 8800000,
  budget_used: 5800000,
  total_savings: 20300000,
  savings_progress: 65.8,
  monthly_trend: {
    labels: ['T5', 'T6', 'T7', 'T8', 'T9'],
    data: [4500000, 5200000, 4800000, 5500000, 6000000]
  },
  category_breakdown: {
    labels: ['Ăn uống', 'Di chuyển', 'Giải trí', 'Mua sắm', 'Học tập', 'Sức khỏe'],
    data: [2150000, 650000, 420000, 1530000, 450000, 600000]
  },
  top_categories: [
    { category: 'Ăn uống', amount: 2150000, percent: 35.8 },
    { category: 'Mua sắm', amount: 1530000, percent: 25.5 },
    { category: 'Di chuyển', amount: 650000, percent: 10.8 }
  ]
};

// Mock AI insights
export const mockAIInsights = {
  score: 72,
  breakdown: {
    'Quản lý chi tiêu': 75,
    'Tuân thủ ngân sách': 68,
    'Tiết kiệm': 80,
    'Xu hướng': 65
  },
  recommendations: [
    { category: 'Ăn uống', message: 'Chi tiêu ăn uống đã vượt 70% ngân sách. Hãy cân nhắc nấu ăn tại nhà nhiều hơn.', priority: 'high' },
    { category: 'Giải trí', message: 'Chi tiêu giải trí đang tăng 15% so với tháng trước.', priority: 'medium' },
    { category: 'Tiết kiệm', message: 'Bạn đang tiết kiệm tốt! Tiếp tục duy trì để đạt mục tiêu.', priority: 'low' }
  ]
};

// Mock forecast data
export const mockForecast = {
  labels: ['T6', 'T7', 'T8', 'T9', 'T10 (dự báo)', 'T11 (dự báo)'],
  actual: [5200000, 4800000, 5500000, 6000000, null, null],
  forecast: [null, null, null, 6000000, 6200000, 6100000]
};

// Helper function to calculate expenses by category
export function getExpensesByCategory() {
  const categoryTotals = {};
  mockExpenses.forEach(expense => {
    if (!categoryTotals[expense.category]) {
      categoryTotals[expense.category] = 0;
    }
    categoryTotals[expense.category] += expense.amount;
  });
  return categoryTotals;
}

// Helper function to get expenses by date range
export function getExpensesByDateRange(startDate, endDate) {
  return mockExpenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return expenseDate >= start && expenseDate <= end;
  });
}

// Helper function to calculate total expenses
export function getTotalExpenses() {
  return mockExpenses.reduce((sum, expense) => sum + expense.amount, 0);
}
