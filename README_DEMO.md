# SVFinance - Frontend Demo Guide

## 📋 Thông tin dự án
**Đề tài:** Hệ thống quản lý tài chính sinh viên với AI  
**Thành viên:**
- **Trần Văn Quốc** - Backend/DB/AI (Lead)
- **Huỳnh Văn Quân** - Frontend/UI/UX (Lead)

## 🎯 Tiến độ hiện tại (Tuần 5-6)
✅ Dashboard với KPI cards và charts  
✅ Trang Expenses (Quản lý chi tiêu)  
✅ Trang Budgets (Ngân sách)  
✅ Trang Savings (Mục tiêu tiết kiệm)  
✅ Trang Analytics & AI Panel  
✅ Layout responsive với Bootstrap 5  
🔄 Đang sử dụng **mock data** cho demo (chưa kết nối backend)

## 🚀 Cách chạy demo

### 1. Cài đặt dependencies
```bash
pip install -r requirements.txt
```

### 2. Chạy ứng dụng
```bash
python app.py
```

### 3. Truy cập
Mở trình duyệt và vào: **http://127.0.0.1:5000**

## 📁 Cấu trúc Frontend

```
QLTC_FE/
├── app.py                      # Flask routes
├── templates/
│   ├── base.html               # Layout chính (navbar + sidebar)
│   ├── base_auth.html          # Layout cho auth pages
│   ├── dashboard.html          # ✅ Trang chủ với KPI & charts
│   ├── auth/
│   │   ├── login.html          # ✅ Đăng nhập
│   │   ├── register.html       # ✅ Đăng ký
│   │   ├── forgot.html         # Quên mật khẩu
│   │   └── reset.html          # Đặt lại mật khẩu
│   ├── expenses/
│   │   ├── list.html           # ✅ Danh sách chi tiêu
│   │   └── form.html           # Form thêm/sửa
│   ├── budget/
│   │   ├── index.html          # ✅ Quản lý ngân sách
│   │   └── form.html           # Form ngân sách
│   ├── savings/
│   │   ├── index.html          # ✅ Mục tiêu tiết kiệm
│   │   └── form.html           # Form mục tiêu
│   ├── analytics/
│   │   ├── index.html          # ✅ Phân tích tài chính
│   │   └── ai_panel.html       # ✅ AI Panel
│   ├── admin/                  # Admin panel (tuần sau)
│   └── partials/
│       ├── _navbar.html        # ✅ Navigation bar
│       ├── _sidebar.html       # ✅ Sidebar menu
│       ├── _toast.html         # Toast notifications
│       └── _modals.html        # Modal components
├── static/
│   ├── css/
│   │   ├── app.css             # ✅ Main styles
│   │   ├── variables.css       # ✅ CSS variables
│   │   └── admin.css           # Admin styles
│   ├── js/
│   │   ├── app.js              # ✅ Main app logic
│   │   ├── api.js              # ✅ API wrapper
│   │   ├── auth.js             # ✅ Authentication
│   │   ├── expenses.js         # ✅ Expenses management
│   │   ├── budgets.js          # ✅ Budgets management
│   │   ├── savings.js          # ✅ Savings management
│   │   ├── analytics.js        # ✅ Analytics
│   │   ├── ai.js               # ✅ AI features
│   │   ├── charts.js           # ✅ Chart.js config
│   │   ├── admin.js            # Admin panel
│   │   ├── mock-data.js        # ✅ Mock data cho demo
│   │   └── utils/
│   │       ├── dom.js          # ✅ DOM helpers
│   │       ├── format.js       # ✅ Formatting utilities
│   │       ├── validators.js   # ✅ Form validation
│   │       └── storage.js      # ✅ LocalStorage
│   ├── img/                    # Images
│   └── icons/                  # Icons
```

## 🎨 Các trang đã hoàn thành

### 1. Dashboard (/)
- **KPI Cards:** Số dư, Chi tiêu, Tiết kiệm, Điểm AI
- **Charts:** Bar chart (xu hướng), Pie chart (danh mục)
- **Widgets:** Giao dịch gần đây, Ngân sách, Mục tiêu tiết kiệm
- **AI Insights:** Gợi ý thông minh từ AI

### 2. Quản lý Chi tiêu (/expenses)
- Danh sách giao dịch với filter theo danh mục
- Form thêm/sửa/xóa chi tiêu
- Charts: Pie (theo danh mục), Line (theo thời gian)
- KPI: Tổng chi, Số giao dịch, Trung bình

### 3. Ngân sách (/budgets)
- Tổng quan ngân sách (Tổng, Đã chi, Còn lại)
- Progress bar cho từng danh mục
- Cảnh báo khi vượt 80% ngân sách
- Form thêm/sửa ngân sách

### 4. Mục tiêu Tiết kiệm (/savings)
- Danh sách mục tiêu với progress bar
- Tính toán tiến độ và deadline
- Form thêm/sửa mục tiêu
- Gợi ý đóng góp hàng tháng

### 5. Phân tích (/analytics)
- Tổng quan: Thu nhập, Chi tiêu, Tiết kiệm, Tỷ lệ
- Charts: Xu hướng chi tiêu, Phân bổ danh mục
- AI Insights (nếu bật feature flag)

### 6. AI Panel (/analytics/ai)
- **AI Score:** Điểm số tài chính (0-100)
- **Recommendations:** Gợi ý cải thiện
- **Forecast:** Dự báo chi tiêu
- **Auto Classify:** Phân loại giao dịch tự động

## 📊 Mock Data

Hiện tại frontend đang sử dụng **mock data** trong file `static/js/mock-data.js`:
- 15 giao dịch mẫu
- 6 ngân sách theo danh mục
- 3 mục tiêu tiết kiệm
- Dashboard summary với charts
- AI insights và recommendations

## 🔄 Kết nối Backend (Tuần sau)

Khi Quốc hoàn thành backend API, chỉ cần:

1. Cập nhật `BASE_API_URL` trong `.env`:
```
BASE_API_URL=http://127.0.0.1:8000/api
```

2. Thay đổi flag trong các file JS:
```javascript
const USE_MOCK_DATA = false;  // Chuyển sang false
```

3. API endpoints cần có:
```
GET  /expenses          # Danh sách chi tiêu
POST /expenses          # Thêm chi tiêu
PUT  /expenses/:id      # Sửa chi tiêu
DELETE /expenses/:id    # Xóa chi tiêu

GET  /budgets           # Danh sách ngân sách
POST /budgets           # Thêm ngân sách
...

GET  /savings           # Mục tiêu tiết kiệm
...

GET  /analytics/summary         # Dashboard summary
GET  /analytics/ai-score        # AI Score
GET  /analytics/recommendations # AI Recommendations
GET  /analytics/forecast        # Dự báo
POST /analytics/classify        # Phân loại tự động
```

## 🎯 Checklist Demo

### ✅ Đã hoàn thành
- [x] Layout responsive với Bootstrap 5
- [x] Sidebar navigation với icons
- [x] Dashboard với KPI cards
- [x] Charts (Chart.js): Bar, Pie, Line
- [x] Trang Expenses với CRUD UI
- [x] Trang Budgets với progress tracking
- [x] Trang Savings với goal tracking
- [x] Trang Analytics với insights
- [x] AI Panel UI
- [x] Mock data đầy đủ
- [x] Toast notifications
- [x] Modal components
- [x] Form validation UI

### 🔄 Đang làm (Tuần 6-7)
- [ ] Kết nối API backend
- [ ] Loading states & skeleton screens
- [ ] Error handling
- [ ] Empty states
- [ ] Admin panel UI

### 📝 Tuần sau
- [ ] E2E testing
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Mobile responsive fine-tuning

## 🎨 UI/UX Features

- **Modern Design:** Bootstrap 5 với custom CSS
- **Gradient Cards:** KPI cards với gradient backgrounds
- **Icons:** Bootstrap Icons
- **Charts:** Chart.js cho visualization
- **Responsive:** Mobile-first design
- **Toast Notifications:** Feedback cho user actions
- **Modal Forms:** Thêm/sửa dữ liệu
- **Progress Bars:** Tracking ngân sách và tiết kiệm
- **Badges:** Status và category indicators

## 📱 Demo Scenarios

### Scenario 1: Xem tổng quan tài chính
1. Truy cập Dashboard (/)
2. Xem KPI cards: Số dư, Chi tiêu, Tiết kiệm, Điểm AI
3. Xem charts: Xu hướng chi tiêu, Phân bổ danh mục
4. Đọc AI Insights

### Scenario 2: Quản lý chi tiêu
1. Vào trang Expenses (/expenses)
2. Xem danh sách giao dịch
3. Filter theo danh mục
4. Thêm giao dịch mới (demo UI)
5. Xem charts phân tích

### Scenario 3: Theo dõi ngân sách
1. Vào trang Budgets (/budgets)
2. Xem tổng quan ngân sách
3. Kiểm tra progress từng danh mục
4. Nhận cảnh báo nếu vượt 80%

### Scenario 4: Mục tiêu tiết kiệm
1. Vào trang Savings (/savings)
2. Xem danh sách mục tiêu
3. Kiểm tra tiến độ
4. Xem deadline và gợi ý

### Scenario 5: AI Features
1. Vào AI Panel (/analytics/ai)
2. Xem AI Score (0-100)
3. Đọc recommendations
4. Xem forecast chart
5. Test auto-classify (nhập mô tả giao dịch)

## 🐛 Known Issues (Demo Mode)

- Form submit chỉ update UI, không lưu vào backend
- Data sẽ reset khi refresh trang
- API calls sẽ fail (chưa có backend)
- Some features chỉ là UI placeholder

## 📞 Contact

**Huỳnh Văn Quân** - Frontend Lead  
**Trần Văn Quốc** - Backend Lead

---
**Note:** Đây là bản demo frontend với mock data. Sẽ kết nối backend API trong tuần 7-8 theo kế hoạch.
