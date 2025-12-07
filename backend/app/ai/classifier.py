import pickle
import unidecode
from pathlib import Path

# Lấy đường dẫn thư mục chứa file này: backend/app/ai/
BASE_DIR = Path(__file__).resolve().parent

# Đường dẫn tuyệt đối đến classifier.pkl
MODEL_PATH = BASE_DIR / "classifier.pkl"

# Load model
with open(MODEL_PATH, "rb") as f:
    model = pickle.load(f)

def normalize(text: str):
    return unidecode.unidecode(text.lower().strip())

def predict_category_all(text):
    clean = normalize(text)

    labels = model.classes_
    probs = model.predict_proba([clean])[0]

    result = []
    for label, p in zip(labels, probs):
        result.append({
            "label": label,
            "prob": float(p)
        })

    return sorted(result, key=lambda x: x["prob"], reverse=True)

def predict_category(text):
    """
    Trả về (label, prob) dạng tuple đơn giản.
    Dùng trong NLP parser để map category.
    """
    all_preds = predict_category_all(text)
    if not all_preds:
        return None, 0.0

    top = all_preds[0]
    return top["label"], top["prob"]
