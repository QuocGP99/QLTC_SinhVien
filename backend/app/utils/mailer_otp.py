from flask import render_template
from flask_mail import Message
from ..extensions import mail

def send_otp_email(to_email: str, code: str, ttl_min: int = 10):
    subject = "SVFinance - Mã xác thực tài khoản"
    txt_body = render_template("email/otp.txt", code=code, ttl_min=ttl_min)
    html_body = render_template("email/otp.html", code=code, ttl_min=ttl_min)
    msg = Message(subject=subject, recipients=[to_email], body=txt_body, html=html_body)
    mail.send(msg)
