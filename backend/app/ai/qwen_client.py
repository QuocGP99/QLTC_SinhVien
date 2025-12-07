import requests
import json

OLLAMA_URL = "http://localhost:11434/api/chat"

def call_qwen(prompt: str):
    payload = {
        "model": "qwen2.5:3b",
        "messages": [
            {"role": "system", "content": "Luôn trả về JSON dạng {\"analysis\":\"...\",\"message\":\"...\"}. Không dùng markdown."},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }

    try:
        r = requests.post(OLLAMA_URL, json=payload, timeout=120)
        data = r.json()

        # Debug nếu cần
        print("\n======= RAW QWEN RESPONSE =======")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print("================================\n")

        raw = ""

        # CASE 1: Ollama trả kiểu chuẩn
        if "message" in data:
            raw = data["message"].get("content", "")

        # CASE 2: Ollama trả mảng messages
        elif "messages" in data:
            for msg in reversed(data["messages"]):
                if msg.get("role") == "assistant":
                    raw = msg.get("content", "")
                    break

        # CASE 3: Ollama trả dạng array stream
        elif isinstance(data, list):
            for chunk in data:
                part = chunk.get("message", {}).get("content", "")
                raw += part

        else:
            return {"message": "Kết quả Qwen không hợp lệ"}

        # ép parse JSON, nếu không phải JSON → wrap lại
        try:
            return json.loads(raw)
        except Exception:
            return {"message": raw}

    except Exception as e:
        return {"message": f"Lỗi gọi Qwen: {e}"}
