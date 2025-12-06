from huggingface_hub import login, whoami
import os

token = os.getenv("HF_API_KEY")
print("HF_API_KEY =", token)

print(">>> Thử login...")
login(token, add_to_git_credential=False)

print(">>> Kiểm tra thông tin tài khoản...")
info = whoami()
print(info)
