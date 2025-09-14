# QLTC_SinhVien  
**Đồ án tốt nghiệp – Xây dựng Web quản lý tài chính cá nhân cho sinh viên có tích hợp AI sử dụng Flask Framework**

---

## 📌 Giới thiệu
Đề tài nhằm xây dựng một ứng dụng web gọn nhẹ, trực quan và thông minh giúp sinh viên:
- Quản lý chi tiêu, thu nhập hằng ngày.
- Lập ngân sách và theo dõi tiến độ tiết kiệm.
- Trực quan hóa dữ liệu bằng biểu đồ (Chart.js/Plotly.js).
- Tích hợp AI:
  - **Phân loại chi tiêu tự động** theo mô tả giao dịch.
  - **AI Score** đánh giá sức khỏe tài chính.
  - **Dự báo xu hướng chi tiêu** cho các tháng tiếp theo.

Công nghệ sử dụng:
- **Backend**: Python, Flask, Flask-SQLAlchemy, Flask-Migrate
- **Frontend**: HTML5, CSS3, Bootstrap 5, Jinja2
- **Visualization**: Chart.js / Plotly.js
- **AI/ML**: Scikit-learn, Statsmodels, Numpy, Pandas
- **Database**: SQLite (mặc định), dễ mở rộng sang PostgreSQL/MySQL

---

## 📂 Cấu trúc thư mục

QLTC_SinhVien/
app/
init.py # app factory
config.py
extensions.py # db, migrate, csrf...
models/ # định nghĩa bảng
expense.py, budget.py, savings_goal.py, category.py
services/ # business logic
expense_service.py, budget_service.py, savings_service.py, analytics_service.py
routes/ # API & view
dashboard.py, expenses.py, budget.py, savings.py, analytics.py
templates/ # Jinja2 templates
base.html, dashboard.html, expenses.html, budget.html, savings.html
static/ # CSS, JS, Images
migrations/ # Flask-Migrate quản lý DB
tests/ # pytest
instance/ # chứa app.db (ignore khi commit)
.env.example # cấu hình mẫu
requirements.txt
README.md

---

## 🚀 Cài đặt & chạy

### 1. Clone repo
```bash
# HTTPS
git clone https://github.com/QuocGP99/QLTC_SinhVien.git
cd QLTC_SinhVien

# hoặc SSH (nếu đã add SSH key)
git clone git@github.com:QuocGP99/QLTC_SinhVien.git
cd QLTC_SinhVien

2. Tạo môi trường ảo

py -3.12 -m venv .venv
.venv\Scripts\activate    # Windows
source .venv/bin/activate # Linux/Mac

3. Cài đặt dependencies

pip install --upgrade pip
pip install -r requirements.txt

4. Cấu hình môi trường

Tạo file .env ở root:

FLASK_APP=app
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=dev-secret
DATABASE_URL=sqlite:///instance/app.db

5. Khởi tạo database

flask db init      # chỉ lần đầu
flask db migrate -m "init schema"
flask db upgrade

6. Chạy ứng dụng

flask run
Mở trình duyệt: 👉 http://localhost:5000

🧪 Testing

Chạy toàn bộ test với pytest:

pytest -q

🤖 Tính năng AI (planned)

Phân loại chi tiêu: dùng TF-IDF + Logistic Regression/Naive Bayes.

AI Score: đánh giá dựa trên 4 trụ (tỷ lệ chi/thu, % ngân sách dùng, tiến độ tiết kiệm, xu hướng 3 tháng).

Dự báo chi tiêu: Moving Average hoặc Holt-Winters (statsmodels).

👥 Nhóm thực hiện

Trần Văn Quốc – Backend, Database, AI/ML

Huỳnh Văn Quân – Frontend, UI/UX, Visualization

GVHD: ThS. Nguyễn Thị Thu Thủy
Ngành Công nghệ thông tin – Trường ĐH Kiến Trúc Đà Nẵng