import os
from flask import Flask, render_template, request, redirect, flash, url_for, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)  # <-- có biến app để flask/py chạy được
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")
app.config["BASE_API_URL"] = os.getenv("BASE_API_URL", "http://127.0.0.1:8000/api")
app.config["FEATURE_FLAGS"] = os.getenv("FEATURE_FLAGS", "ai,charts").split(",")

@app.context_processor
def inject_globals():
    return {"BASE_API_URL": app.config["BASE_API_URL"],
            "FEATURE_FLAGS": app.config["FEATURE_FLAGS"]}

# -------- ROUTES TEST ----------
@app.get("/health")
def health():
    return jsonify(ok=True)

@app.get("/test")
def test():
    return "hello"  # để kiểm tra nhanh

# -------- ROUTES CHÍNH ----------
@app.route("/")
def home():
    # nếu chưa có template, trả tạm chữ để không bị trắng trang
    return render_template("dashboard.html", page_title="Dashboard")

@app.route("/login", methods=["GET","POST"])
def login():
    if request.method == "POST":
        flash("Logged in (demo).", "success")
        return redirect(url_for("home"))
    return render_template("auth/login.html")

@app.route("/register", methods=["GET","POST"])
def register():
    if request.method == "POST":
        flash("Account created (demo).", "success")
        return redirect(url_for("login"))
    return render_template("auth/register.html")

@app.route("/forgot", methods=["GET","POST"])
def forgot():
    if request.method == "POST":
        flash("Reset link sent (demo).", "info")
        return redirect(url_for("login"))
    return render_template("auth/forgot.html")

@app.route("/reset", methods=["GET","POST"])
def reset():
    token = request.args.get("token", "")
    if request.method == "POST":
        flash("Password reset successful (demo).", "success")
        return redirect(url_for("login"))
    return render_template("auth/reset.html", token=token)

# -------- EXPENSES ----------
@app.route("/expenses")
def expenses():
    return render_template("expenses/list.html", page_title="Chi tiêu")

# -------- BUDGETS ----------
@app.route("/budgets")
def budgets():
    return render_template("budget/index.html", page_title="Ngân sách")

# -------- SAVINGS ----------
@app.route("/savings")
def savings():
    return render_template("savings/index.html", page_title="Mục tiêu tiết kiệm")

# -------- ANALYTICS ----------
@app.route("/analytics")
def analytics():
    return render_template("analytics/index.html", page_title="Phân tích tài chính")

@app.route("/analytics/ai")
def analytics_ai():
    return render_template("analytics/ai_panel.html", page_title="AI Panel")

# -------- ADMIN ----------
@app.route("/admin/users")
def admin_users():
    return render_template("admin/users.html", page_title="Quản lý Users")

@app.route("/admin/transactions")
def admin_transactions():
    return render_template("admin/transactions.html", page_title="Quản lý Transactions")

@app.route("/admin/budgets")
def admin_budgets():
    return render_template("admin/budgets.html", page_title="Quản lý Budgets")

@app.route("/admin/savings")
def admin_savings():
    return render_template("admin/savings.html", page_title="Quản lý Savings")

@app.route("/admin/system")
def admin_system():
    return render_template("admin/system.html", page_title="System Settings")

# -------- REPORTS & SETTINGS ----------
@app.route("/reports")
def reports():
    return render_template("reports.html", page_title="Báo cáo")

@app.route("/settings")
def settings():
    return render_template("settings.html", page_title="Cài đặt")
if __name__ == "__main__":
    print(">>> app.py loaded from:", __file__)
    app.run(debug=True)
