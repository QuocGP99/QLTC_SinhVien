import os
import requests
import json

HF_API_KEY = os.getenv("HF_API_KEY")
print("Token:", HF_API_KEY)

url = "https://router.huggingface.co/hf-inference/models/HuggingFaceM4/Idefics3-8B-Llama3"

headers = {
    "Authorization": f"Bearer {HF_API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "inputs": "Xin chào, bạn đang hoạt động không?",
    "parameters": {
        "max_new_tokens": 50,
        "temperature": 0.1
    }
}

response = requests.post(url, headers=headers, data=json.dumps(payload))

print("Status:", response.status_code)
print("Response:", response.text)
