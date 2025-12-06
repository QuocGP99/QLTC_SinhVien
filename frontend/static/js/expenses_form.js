// ==============================
// EXPENSE FORM + OCR (WSL OCR SERVICE)
// ==============================

const btnUpload = document.querySelector("#btnUploadReceiptInModal");
const inputFile = document.querySelector("#expenseReceiptHidden");
const previewBox = document.querySelector("#extReceiptPreview");

// CLICK → OPEN PICKER
if (btnUpload && inputFile) {
  btnUpload.addEventListener("click", () => inputFile.click());
}

// WHEN CHOSEN
if (inputFile && previewBox) {
  inputFile.addEventListener("change", async () => {
    const file = inputFile.files[0];
    if (!file) return;

    previewBox.classList.remove("d-none");
    previewBox.innerHTML = `
      <img src="${URL.createObjectURL(file)}"
           class="img-fluid rounded border"
           style="max-height:180px;object-fit:contain;">
    `;

    await sendToOCR(file);
  });
}

// SEND TO BACKEND → forwards to WSL OCR service
async function sendToOCR(file) {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/ocr/receipt", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });

    const data = await res.json();
    console.log("OCR RESULT:", data);

    if (data.success) fillForm(data);
  } catch (err) {
    console.error(err);
  }
}

// AUTO FILL FORM
function fillForm(data) {
  if (data.amount) document.getElementById("expenseAmount").value = data.amount;
  if (data.description) {
    document.getElementById("expenseDesc").value = data.description;
    predictCategory(data.description);
  }
  if (data.date) document.getElementById("expenseDate").value = data.date;
  if (data.category_id)
    document.getElementById("expenseCategory").value = data.category_id;
  if (data.payment_method_id)
    document.getElementById("expensePaymentMethod").value =
      data.payment_method_id;
}

//Lắng nghe khi người dùng gõ mô tả
const descInput = document.getElementById("expenseDesc");
const aiSuggestBox = document.getElementById("aiCatSuggest");

let typingTimer;
if (descInput) {
  descInput.addEventListener("input", () => {
    clearTimeout(typingTimer);
    const text = descInput.value.trim();
    if (!text) {
      aiSuggestBox.textContent = "";
      return;
    }

    // delay 400ms chống spam API
    typingTimer = setTimeout(() => {
      predictCategory(text);
    }, 400);
  });
}
//Hàm gọi API dự đoán
async function predictCategory(text) {
  try {
    const token = localStorage.getItem("access_token");
    const res = await fetch("/api/expenses/predict_category", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();

    console.log("AI Predict:", data);

    const box = document.getElementById("aiCatSuggest");
    box.innerHTML = `<div class="text-muted small mb-1">AI gợi ý:</div>`;

    data.predictions
      .filter((item) => item.prob >= 0.1) // CHỈ CHO HIỂN THỊ >= 10%
      .forEach((item) => {
        const percent = (item.prob * 100).toFixed(0);

        box.insertAdjacentHTML(
          "beforeend",
          `
      <button
        class="btn btn-sm btn-outline-primary me-2 mb-2 ai-cat-btn"
        data-cid="${item.category_id}"
        data-label="${item.label}"
      >
        ${item.label} • ${percent}%
      </button>
      `
        );
      });

    // gắn sự kiện click
    document.querySelectorAll(".ai-cat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cid = btn.dataset.cid;
        if (cid) {
          document.getElementById("expenseCategory").value = cid;
        }

        // đổi màu khi được chọn
        document
          .querySelectorAll(".ai-cat-btn")
          .forEach((b) => b.classList.remove("btn-primary"));

        btn.classList.remove("btn-outline-primary");
        btn.classList.add("btn-primary");
        // Gửi feedback về backend
        sendAiFeedback(descInput.value, cid, data.predictions);
      });
    });
  } catch (err) {
    console.error("Predict Error:", err);
  }
}

// Gửi feedback về backend
async function sendAiFeedback(description, chosenCategory, predictions) {
  try {
    const token = localStorage.getItem("access_token");
    await fetch("/api/expenses/ai_feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        description: description,
        chosen_category_id: chosenCategory,
        predictions: predictions,
      }),
    });

    console.log("AI feedback: saved");
  } catch (err) {
    console.error("AI feedback error:", err);
  }
}
