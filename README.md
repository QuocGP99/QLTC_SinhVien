# 💰 QLTC_SinhVien - Ứng dụng Quản lý Tài chính Cá nhân

**Đồ án tốt nghiệp – Xây dựng Web quản lý tài chính cá nhân cho sinh viên có tích hợp AI sử dụng Flask Framework**

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-2.3%2B-darkgreen)](https://flask.palletsprojects.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13%2B-336791)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📌 Giới thiệu

**QLTC_SinhVien** là ứng dụng web quản lý tài chính cá nhân toàn diện, được thiết kế đặc biệt cho sinh viên. Ứng dụng cung cấp các tính năng thông minh để giúp người dùng:

✅ **Quản lý tài chính**

- Quản lý chi tiêu, thu nhập hằng ngày
- Quản lý ngân sách theo danh mục
- Theo dõi mục tiêu tiết kiệm
- Quản lý nhiều nguồn tiền (ví tiền mặt, thẻ ngân hàng, ví điện tử)

✅ **Phân tích & Dự báo**

- Phân loại chi tiêu tự động bằng AI
- Biểu đồ phân tích chi tiêu (Chart.js / Plotly.js)
- Dự báo xu hướng chi tiêu 30 ngày tiếp theo (Prophet)
- AI Score đánh giá sức khỏe tài chính

✅ **Tính năng nâng cao**

- Chatbot AI (Qwen) tư vấn tài chính
- Email scheduler gửi báo cáo hàng tuần
- Hỗ trợ nhiều ngôn ngữ
- Dashboard trực quan & hiện đại

---

## 🛠️ Công nghệ sử dụng

| Lớp                | Công nghệ                                |
| ------------------ | ---------------------------------------- |
| **Backend**        | Python 3.10+, Flask 2.3+, SQLAlchemy     |
| **Frontend**       | HTML5, CSS3, Bootstrap 5, JavaScript     |
| **Database**       | PostgreSQL 13+ (SQLite cho development)  |
| **AI/ML**          | Qwen GGUF, Prophet, Scikit-learn, Pandas |
| **Visualization**  | Chart.js, Plotly.js                      |
| **Deployment**     | Docker, Docker Compose                   |
| **Authentication** | Flask-JWT-Extended                       |

---

## 📂 Cấu trúc thư mục

```
QLTC_SinhVien/
├── backend/                          # Backend Flask
│   ├── app/
│   │   ├── __init__.py              # App factory
│   │   ├── config.py                # Cấu hình
│   │   ├── extensions.py            # Extensions (db, migrate, jwt)
│   │   ├── models/                  # Database models (14 models)
│   │   │   ├── user.py              # User model
│   │   │   ├── expense.py           # Expense model
│   │   │   ├── income.py            # Income model
│   │   │   ├── budget.py            # Budget model
│   │   │   ├── savings_goal.py      # SavingsGoal model
│   │   │   ├── money_source.py      # MoneySource model
│   │   │   └── ...
│   │   ├── routes/                  # API routes (14 routes)
│   │   │   ├── auth.py              # Authentication
│   │   │   ├── expenses.py          # Expense management
│   │   │   ├── income.py            # Income management
│   │   │   ├── budgets.py           # Budget management
│   │   │   ├── savings.py           # Savings goals
│   │   │   ├── money_sources.py     # Money sources management
│   │   │   ├── analytics.py         # Analytics & reports
│   │   │   ├── ai_api.py            # AI chatbot API
│   │   │   └── ...
│   │   ├── services/                # Business logic (14 services)
│   │   │   ├── expense_service.py   # Expense operations
│   │   │   ├── income_service.py    # Income operations
│   │   │   ├── budget_service.py    # Budget validation
│   │   │   ├── savings_service.py   # Savings goal tracking
│   │   │   ├── analytics_service.py # Data analysis
│   │   │   ├── forecast_service.py  # Expense forecasting
│   │   │   ├── email_service.py     # Email notifications
│   │   │   └── ...
│   │   ├── ai/                      # AI modules
│   │   │   ├── chat_pipeline.py     # Chatbot pipeline
│   │   │   ├── classifier.py        # Category classifier
│   │   │   ├── nlp_rules.py         # NLP extraction
│   │   │   └── qwen_handler.py      # Qwen AI integration
│   │   ├── tools/                   # Utility tools
│   │   ├── seed/                    # Database seeders
│   │   └── migrations/              # Flask-Migrate files
│   ├── tests/                       # Unit & integration tests (25+ files)
│   ├── sql/                         # SQL scripts
│   │   ├── create_tables.py         # Schema initialization
│   │   ├── fix_and_add_constraint.sql # Data integrity fix
│   │   └── ...
│   ├── requirements.txt             # Python dependencies
│   ├── run.py                       # Development server
│   ├── wsgi.py                      # WSGI entry point
│   └── Dockerfile                   # Docker configuration
│
├── frontend/                         # Frontend files
│   ├── templates/                   # HTML templates
│   │   ├── base.html                # Base layout
│   │   ├── auth/                    # Login/Register pages
│   │   ├── dashboard/               # Dashboard pages
│   │   ├── expenses/                # Expense pages
│   │   ├── income/                  # Income pages
│   │   ├── budgets/                 # Budget pages
│   │   ├── savings/                 # Savings goal pages
│   │   ├── money_sources/           # Money source pages
│   │   └── ai/                      # AI chatbot pages
│   └── static/                      # Static files (CSS, JS, images)
│       ├── css/
│       ├── js/
│       └── images/
│
├── json/                            # Postman collections
│   ├── QLTC_SinhVien.postman_collection.json
│   └── QLTC local.postman_environment.json
│
├── backup/                          # Database backups
│   ├── svfinance_full_backup.sql
│   └── svfinance_full_backup.dump
│
├── REPORT/                          # Documentation reports
│   ├── MONEY_SOURCES_*.md
│   ├── IMPLEMENTATION_SUMMARY.md
│   └── ...
│
├── docker-compose.yml               # Docker Compose configuration
├── .env.example                     # Environment variables template
├── .gitignore                       # Git ignore rules
├── SETUP_GUIDE.md                   # Installation guide
├── README.md                        # This file
└── requirements.txt                 # Project dependencies

```

---

## 🚀 Hướng dẫn cài đặt

### 1️⃣ Clone Repository

```bash
# HTTPS
git clone https://github.com/QuocGP99/QLTC_SinhVien.git
cd QLTC_SinhVien

# Hoặc SSH (nếu đã add SSH key)
git clone git@github.com:QuocGP99/QLTC_SinhVien.git
cd QLTC_SinhVien
```

### 2️⃣ Tạo môi trường ảo (Python 3.10+)

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# Linux/Mac
python3 -m venv .venv
source .venv/bin/activate
```

### 3️⃣ Cài đặt Dependencies

```bash
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### 4️⃣ Cấu hình môi trường

Tạo file `.env` ở thư mục root (copy từ `.env.example`):

```bash
# Backend configuration
FLASK_APP=backend.run
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=your-secret-key-here

# Database (PostgreSQL)
DATABASE_URL=postgresql://svfinance_user:223597@localhost:5432/svfinance

# JWT Configuration
JWT_SECRET_KEY=your-jwt-secret-key

# Email configuration (optional)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password

# Qwen AI configuration
QWEN_MODEL_PATH=./models/qwen-model.gguf
```

### 5️⃣ Khởi tạo Database

**Đối với PostgreSQL:**

```bash
# Kết nối đến PostgreSQL
psql -U postgres

# Tạo database và user
CREATE DATABASE svfinance;
CREATE USER svfinance_user WITH PASSWORD '223597';
GRANT ALL PRIVILEGES ON DATABASE svfinance TO svfinance_user;
```

**Chạy Flask migrations:**

```bash
cd backend
flask db upgrade
```

### 6️⃣ Chạy ứng dụng

**Development mode:**

```bash
cd backend
flask run --host=127.0.0.1 --port=5000
```

**Production mode (với Gunicorn):**

```bash
cd backend
gunicorn -w 4 -b 0.0.0.0:5000 wsgi:app
```

**Với Docker Compose:**

```bash
docker-compose up -d
```

> **Mở trình duyệt:** 👉 `http://localhost:5000`

---

## 📊 Các tính năng chính

### 🔐 Authentication & Authorization

- ✅ Đăng ký / Đăng nhập với email
- ✅ JWT token-based authentication
- ✅ Password hashing (bcrypt)
- ✅ Refresh token mechanism

### 💳 Quản lý Giao dịch

- ✅ Quản lý chi tiêu & thu nhập
- ✅ Phân loại tự động (auto-categorization)
- ✅ Hỗ trợ nhiều nguồn tiền
- ✅ Ghi chú chi tiết & ảnh đính kèm
- ✅ Lịch sử giao dịch chi tiết

### 📈 Ngân sách & Tiết kiệm

- ✅ Lập ngân sách theo danh mục
- ✅ Cảnh báo vượt ngân sách
- ✅ Theo dõi mục tiêu tiết kiệm
- ✅ Tính toán tỷ lệ tiết kiệm

### 📊 Phân tích & Báo cáo

- ✅ Biểu đồ chi tiêu theo danh mục
- ✅ Biểu đồ trendline chi tiêu
- ✅ Báo cáo chi tiêu theo tháng/năm
- ✅ AI Score sức khỏe tài chính
- ✅ Dự báo chi tiêu 30 ngày (Prophet)

### 🤖 AI & Chatbot

- ✅ Chatbot tư vấn tài chính (Qwen)
- ✅ Phân loại chi tiêu tự động (NLP)
- ✅ Dự báo xu hướng chi tiêu
- ✅ Gợi ý tiết kiệm thông minh

### 📧 Notifications

- ✅ Email scheduler (APScheduler)
- ✅ Báo cáo hàng tuần
- ✅ Cảnh báo ngân sách
- ✅ In-app notifications

---

## 🧪 Testing

### Chạy Unit Tests

```bash
cd backend
pytest -v                    # Verbose mode
pytest -q                    # Quiet mode
pytest tests/test_expense.py # Test specific file
pytest -k "test_create"      # Test specific function
```

### Test Coverage

```bash
pytest --cov=app tests/
```

### Testing Tools

- **pytest** - Unit testing framework
- **pytest-cov** - Coverage reporting
- **requests** - HTTP client testing

**Test files** được lưu ở: `backend/tests/`

- Tổng cộng: 25+ test files
- Bao gồm: Unit tests, Integration tests, API tests

---

## 📡 API Documentation

### Base URL

```
http://localhost:5000/api
```

### Authentication

Tất cả các request cần JWT token trong header:

```
Authorization: Bearer <your_jwt_token>
```

### Main Endpoints

| Method            | Endpoint                          | Mô tả                            |
| ----------------- | --------------------------------- | -------------------------------- |
| **Auth**          |
| POST              | `/auth/register`                  | Đăng ký tài khoản                |
| POST              | `/auth/login`                     | Đăng nhập                        |
| POST              | `/auth/refresh`                   | Làm mới token                    |
| **Expenses**      |
| GET               | `/expenses`                       | Lấy danh sách chi tiêu           |
| POST              | `/expenses`                       | Tạo chi tiêu mới                 |
| PUT               | `/expenses/<id>`                  | Cập nhật chi tiêu                |
| DELETE            | `/expenses/<id>`                  | Xóa chi tiêu                     |
| **Income**        |
| GET               | `/income`                         | Lấy danh sách thu nhập           |
| POST              | `/income`                         | Tạo thu nhập mới                 |
| **Budgets**       |
| GET               | `/budgets`                        | Lấy danh sách ngân sách          |
| POST              | `/budgets`                        | Tạo ngân sách mới                |
| **Savings Goals** |
| GET               | `/savings-goals`                  | Lấy danh sách mục tiêu tiết kiệm |
| POST              | `/savings-goals`                  | Tạo mục tiêu tiết kiệm           |
| **Analytics**     |
| GET               | `/analytics/summary`              | Tóm tắt tài chính                |
| GET               | `/analytics/expenses/by-category` | Chi tiêu theo danh mục           |
| GET               | `/analytics/ai-score`             | AI Score sức khỏe tài chính      |
| **AI**            |
| POST              | `/ai/chat`                        | Chatbot AI                       |
| POST              | `/ai/classify`                    | Phân loại chi tiêu               |
| POST              | `/ai/create_transaction`          | Tạo giao dịch từ văn bản         |

**Chi tiết API:** Xem `json/QLTC_SinhVien.postman_collection.json`

---

## 🔧 Troubleshooting

### 1. PostgreSQL Connection Error

```
Error: could not connect to server: No such file or directory
```

**Giải pháp:**

```bash
# Kiểm tra PostgreSQL đang chạy
sudo systemctl status postgresql  # Linux
brew services list                # Mac
# Windows: Check Services

# Khởi động PostgreSQL
sudo systemctl start postgresql   # Linux
brew services start postgresql    # Mac
```

### 2. Database Migration Error

```
Error: Can't locate Alembic configuration file
```

**Giải pháp:**

```bash
cd backend
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```

### 3. Import Error: ModuleNotFoundError

```
ModuleNotFoundError: No module named 'flask'
```

**Giải pháp:**

```bash
# Kích hoạt virtual environment
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# Cài lại dependencies
pip install -r requirements.txt
```

### 4. Port 5000 Already in Use

```
OSError: [Errno 98] Address already in use
```

**Giải pháp:**

```bash
# Tìm process sử dụng port 5000
lsof -i :5000  # Linux/Mac
netstat -ano | findstr :5000  # Windows

# Kill process
kill -9 <PID>  # Linux/Mac
taskkill /PID <PID> /F  # Windows

# Hoặc dùng port khác
flask run --port=5001
```

### 5. Qwen AI Model Not Found

```
Error: Model file not found at ./models/qwen-model.gguf
```

**Giải pháp:**

- Download Qwen model từ Hugging Face
- Đặt vào thư mục `backend/models/`
- Cập nhật `QWEN_MODEL_PATH` trong `.env`

### 6. Email Scheduler Not Working

```
Error: SMTPAuthenticationError
```

**Giải pháp:**

- Kiểm tra Gmail App Password (không phải password chính)
- Enable "Less secure app access" (nếu cần)
- Cập nhật `.env` với credentials đúng

---

## 📖 Tài liệu thêm

- 📘 [SETUP_GUIDE.md](SETUP_GUIDE.md) - Hướng dẫn cài đặt chi tiết
- 📋 [DEMO_FLOW.py](DEMO_FLOW.py) - Flow demo ứng dụng
- 🔍 [ACTION_REQUIRED.md](ACTION_REQUIRED.md) - Các hành động cần thực hiện
- 📊 [REPORT/](REPORT/) - Các báo cáo tổng hợp

---

## 👨‍💻 Contributors

- **Quốc Gp99** - Author & Main Developer

---

## 📝 License

MIT License - Xem [LICENSE](LICENSE) để biết chi tiết.

---

## 📧 Support & Contact

Nếu bạn có câu hỏi hoặc gặp vấn đề, vui lòng:

- Mở issue trên GitHub
- Liên hệ: `quocgp99@gmail.com`

---

**Last Updated:** January 2, 2026  
**Status:** ✅ Production Ready

Phân loại chi tiêu: dùng TF-IDF + Logistic Regression/Naive Bayes.

AI Score: đánh giá dựa trên 4 trụ (tỷ lệ chi/thu, % ngân sách dùng, tiến độ tiết kiệm, xu hướng 3 tháng).

Dự báo chi tiêu: Moving Average hoặc Holt-Winters (statsmodels).

👥 Nhóm thực hiện

Trần Văn Quốc – Backend, Database, AI/ML

Huỳnh Văn Quân – Frontend, UI/UX, Visualization

GVHD: ThS. Nguyễn Thị Thu Thủy
Ngành Công nghệ thông tin – Trường ĐH Kiến Trúc Đà Nẵng
