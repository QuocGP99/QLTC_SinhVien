from threading import Thread
from flask import current_app, render_template
from flask_mail import Message
from ..extensions import mail

def _send_async(app, msg):
    with app.app_context():
        mail.send(msg)

def send_email(to: str, subject: str, template_name: str, **ctx):
    msg = Message(subject=subject, recipients=[to])
    # text fallback (optional)
    msg.body = render_template(f"email/{template_name}.txt", **ctx)
    # html body
    msg.html = render_template(f"email/{template_name}.html", **ctx)

    app = current_app._get_current_object()
    Thread(target=_send_async, args=(app, msg), daemon=True).start()
