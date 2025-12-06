(() => {
  const $ = (sel) => document.querySelector(sel); // ✔ Đặt lên đầu

  const WKEY = "svf_chat_history";
  const TOKEN =
    localStorage.getItem("access_token") || localStorage.getItem("token") || "";

  const elFab = $("#chatbot-fab");
  const elBox = $("#chatbot-widget");
  const elBody = $("#chatbot-body");
  const elForm = $("#chatbot-form");
  const elInput = $("#chatbot-text");
  const elClose = $("#chatbot-close-btn");
  const elMin = $("#chatbot-minimize-btn");
  const elClear = $("#chatbot-clear-btn"); // ✔ Lúc này đã OK
  const elSuggestWrap = $("#chatbot-suggest");

  if (!elFab || !elBox) return;

  // =======================
  // Xóa lịch sử chat
  // =======================
  let history = [];
  if (elClear) {
    elClear.addEventListener("click", () => {
      localStorage.removeItem(WKEY);
      history = [];
      elBody.innerHTML = "";
      appendMsg("assistant", "Đã xóa lịch sử chat.", true);
    });
  }

  // Load history
  try {
    const cached = JSON.parse(localStorage.getItem(WKEY) || "[]");
    if (Array.isArray(cached)) history = cached;
  } catch (_) {}

  function appendMsg(role, content, save = true) {
    const row = document.createElement("div");
    row.className = `chat-row ${role}`;
    row.innerHTML = `<div class="chat-msg ${
      role === "user" ? "user" : "bot"
    }">${content}</div>`;
    elBody.appendChild(row);
    elBody.scrollTop = elBody.scrollHeight;

    if (save) {
      history.push({ role, content });
      localStorage.setItem(WKEY, JSON.stringify(history));
    }
  }

  function openBox() {
    elBox.classList.remove("hidden");
  }

  function closeBox() {
    elBox.classList.add("hidden");
  }

  function minimizeBox() {
    elBox.style.maxHeight = elBox.style.maxHeight ? "" : "50px";
    elBody.style.display = elBody.style.display === "none" ? "" : "none";
    elForm.style.display = elForm.style.display === "none" ? "" : "none";
    if (elSuggestWrap) {
      elSuggestWrap.style.display =
        elSuggestWrap.style.display === "none" ? "" : "none";
    }
  }

  // ================================
  // Gửi sang AI
  // ================================
  async function sendToAI(text) {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ text }),
    });
    return await res.json();
  }

  // ================================
  // Xác nhận Lưu giao dịch
  // ================================
  function showConfirm(data) {
    const wrap = document.createElement("div");
    wrap.className = "chat-confirm mt-2";

    const yes = document.createElement("button");
    yes.className = "btn btn-success btn-sm me-2";
    yes.textContent = "Đồng ý";

    const no = document.createElement("button");
    no.className = "btn btn-secondary btn-sm";
    no.textContent = "Không";

    wrap.appendChild(yes);
    wrap.appendChild(no);
    elBody.appendChild(wrap);

    yes.onclick = async () => {
      wrap.remove();

      const endpoint =
        data.type === "income" ? "/api/incomes" : "/api/expenses";

      const payload = {
        amount: data.amount,
        desc: data.note,
        category_id: data.category_id,
        ...(data.type === "income"
          ? { received_at: new Date().toISOString().slice(0, 10) }
          : { spent_at: new Date().toISOString().slice(0, 10) }),
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify(payload),
      });

      const s = await res.json();
      appendMsg("assistant", s.message || "Đã lưu giao dịch thành công!", true);
    };

    no.onclick = () => {
      wrap.remove();
      appendMsg("assistant", "OK, mình không lưu giao dịch này.");
    };
  }

  // ================================
  // Xử lý gửi tin nhắn
  // ================================
  elForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = elInput.value.trim();
    if (!text) return;

    appendMsg("user", text);
    elInput.value = "";

    const typing = document.createElement("div");
    typing.className = "chat-row bot";
    typing.innerHTML = `<div class="chat-msg bot">Đang soạn…</div>`;
    elBody.appendChild(typing);

    const data = await sendToAI(text);
    typing.remove();

    if (data.confirm) {
      appendMsg(
        "assistant",
        `→ ${data.type.toUpperCase()} • ${data.category} • ${
          data.amount
        }đ\nBạn muốn lưu giao dịch này không?`,
        true
      );
      showConfirm(data);
      return;
    }

    if (data.action === "redirect") {
      appendMsg("assistant", "Mình đang chuyển bạn sang trang yêu cầu.");
      window.location.href = data.to;
      return;
    }

    appendMsg("assistant", data.message || "Mình chưa hiểu câu này.");
  });

  // Init UI
  elFab.addEventListener("click", () =>
    elBox.classList.contains("hidden") ? openBox() : closeBox()
  );
  elClose.addEventListener("click", closeBox);
  elMin.addEventListener("click", minimizeBox);

  elBody.innerHTML = "";
  history.forEach((m) => appendMsg(m.role, m.content, false));
})();
