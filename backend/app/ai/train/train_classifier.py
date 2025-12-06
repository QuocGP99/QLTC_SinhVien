import pandas as pd
import pickle
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
import unidecode

def normalize_text(text):
    text = text.lower().strip()
    text = unidecode.unidecode(text)
    return text

# Load dataset
df = pd.read_csv("dataset_1000.csv")

# Normalize
df["text_clean"] = df["text"].apply(normalize_text)

X = df["text_clean"]
y = df["category"]

# Split tập train/test
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Pipeline TF-IDF + Logistic Regression
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1,2))),
    ("clf", LogisticRegression(max_iter=1000))
])

# Train
pipeline.fit(X_train, y_train)

# Đánh giá nhanh
score = pipeline.score(X_test, y_test)
print("Accuracy:", score)

# Lưu mô hình
with open("../classifier.pkl", "wb") as f:
    pickle.dump(pipeline, f)

print("Đã lưu mô hình vào ../classifier.pkl")
