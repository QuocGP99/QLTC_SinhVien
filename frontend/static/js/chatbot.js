(() => {
  const $ = (sel) => document.querySelector(sel);

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
  const elClear = $("#chatbot-clear-btn");
  const elSuggestWrap = $("#chatbot-suggest");

  if (!elFab || !elBox) return;

  // =============== XÓA LỊCH SỬ CHAT ===============
  let history = [];
  if (elClear) {
    elClear.addEventListener("click", () => {
      localStorage.removeItem(WKEY);
      history = [];
      elBody.innerHTML = "";
      appendMsg("assistant", "Đã xóa lịch sử chat.", true);
    });
  }

  // =============== LOAD HISTORY ===============
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

  // =============== API CALL ===============
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

  // =============== APPLY BUDGET ===============
  async function applyBudget(b) {
    const payload = {
      category_id: b.category_id,
      amount: b.amount,
      increment: b.increment,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    };

    const res = await fetch("/api/budgets/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const s = await res.json();
    appendMsg("assistant", s.message || "Ngân sách đã được cập nhật!", true);
  }

  // =============== SHOW CONFIRM ===============
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
    elBody.scrollTop = elBody.scrollHeight; // Auto scroll xuống confirm

    // ====================================
    // 1) SET SAVING GOAL (tạo mục tiêu)
    // ====================================
    if (data.intent === "set_saving_goal") {
      yes.onclick = async () => {
        wrap.remove();

        const payload = {
          name: data.goal_name,
          target_amount: data.amount,
        };

        const res = await fetch("/api/savings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TOKEN}`,
          },
          body: JSON.stringify(payload),
        });

        const out = await res.json();
        appendMsg(
          "assistant",
          out.message || "Đã tạo mục tiêu tiết kiệm!",
          true
        );
      };

      no.onclick = () => {
        wrap.remove();
        appendMsg("assistant", "OK, mình không tạo mục tiêu.", true);
      };

      return;
    }

    // ====================================
    // 2) UPDATE SAVING GOAL (góp thêm tiền)
    // ====================================
    if (data.intent === "update_saving_goal") {
      yes.onclick = async () => {
        wrap.remove();

        const payload = { amount: data.amount };

        const res = await fetch(`/api/savings/${data.goal_id}/contribute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TOKEN}`,
          },
          body: JSON.stringify(payload),
        });

        const out = await res.json();
        appendMsg(
          "assistant",
          out.message || "Đã góp thêm vào mục tiêu!",
          true
        );
      };

      no.onclick = () => {
        wrap.remove();
        appendMsg("assistant", "OK, mình không cập nhật mục tiêu.", true);
      };

      return;
    }

    // ====================================
    // 3) SET BUDGET
    // ====================================
    if (data.intent === "set_budget") {
      yes.onclick = async () => {
        wrap.remove();
        await applyBudget(data);
      };

      no.onclick = () => {
        wrap.remove();
        appendMsg("assistant", "OK, mình không cập nhật ngân sách.");
      };

      return;
    }

    // ====================================
    // 4) TRANSACTION confirm
    // ====================================
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

      const out = await res.json();
      appendMsg("assistant", out.message || "Đã lưu giao dịch!", true);
    };

    no.onclick = () => {
      wrap.remove();
      appendMsg("assistant", "OK, mình không lưu giao dịch này.");
    };
  }

  // =============== HANDLE SEND MESSAGE ===============
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

    // ----------------------------
    // HANDLE CONFIRM YES/NO
    // ----------------------------
    if (data.intent === "confirm_yes") {
      if (window._pendingBudget) {
        await applyBudget(window._pendingBudget);
        window._pendingBudget = null;
      } else {
        appendMsg("assistant", "Không có gì để xác nhận.");
      }
      return;
    }

    if (data.intent === "confirm_no") {
      appendMsg("assistant", "OK, mình không thực hiện thay đổi.");
      window._pendingBudget = null;
      return;
    }

    // ----------------------------
    // HANDLE REDIRECT
    // ----------------------------
    if (data.action === "redirect") {
      appendMsg("assistant", "Mình đang chuyển bạn sang trang yêu cầu.");
      window.location.href = data.to;
      return;
    }

    // ----------------------------
    // CONFIRM SET BUDGET
    // ----------------------------
    if (data.intent === "set_budget" && data.confirm) {
      window._pendingBudget = data;

      appendMsg(
        "assistant",
        data.message ||
          `Bạn muốn đặt ngân sách ${data.budget_category} = ${data.amount}đ phải không?`,
        true
      );

      showConfirm(data);
      return;
    }

    // CONFIRM SET SAVING GOAL
    if (
      (data.intent === "set_saving_goal" ||
        data.intent === "update_saving_goal") &&
      data.confirm
    ) {
      appendMsg("assistant", data.message, true);
      showConfirm(data);
      return;
    }

    // ----------------------------
    // CONFIRM ADD TRANSACTION
    // ----------------------------
    if (data.confirm && data.intent === "add_transaction") {
      appendMsg(
        "assistant",
        `→ ${data.type.toUpperCase()} - ${data.category} - ${
          data.amount
        }đ\nBạn muốn lưu giao dịch này không?`,
        true
      );
      showConfirm(data);
      return;
    }

    // ----------------------------
    // DEFAULT MESSAGE
    // ----------------------------
    appendMsg(
      "assistant",
      data.message ||
        data.note ||
        data.analysis ||
        data.reply ||
        JSON.stringify(data, null, 2)
    );
  });

  // Init UI events
  elFab.addEventListener("click", () =>
    elBox.classList.contains("hidden") ? openBox() : closeBox()
  );
  elClose.addEventListener("click", closeBox);
  elMin.addEventListener("click", minimizeBox);

  elBody.innerHTML = "";
  history.forEach((m) => appendMsg(m.role, m.content, false));
})();
