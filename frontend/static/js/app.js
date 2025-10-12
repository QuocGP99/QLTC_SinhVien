export function showToast(message, type = "info") {
  // Ưu tiên Bootstrap 5 Toast nếu có
  const hasBootstrap = typeof bootstrap !== "undefined" && bootstrap.Toast;
  const container = document.querySelector(".toast-container");

  if (hasBootstrap && container) {
    // Tạo 1 toast item
    const div = document.createElement("div");
    div.className = `toast align-items-center text-bg-${mapTypeToBs(
      type
    )} border-0`;
    div.setAttribute("role", "alert");
    div.setAttribute("aria-live", "assertive");
    div.setAttribute("aria-atomic", "true");
    div.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    container.appendChild(div);
    const toast = new bootstrap.Toast(div, { delay: 2500 });
    toast.show();
    // Xoá sau khi ẩn
    div.addEventListener("hidden.bs.toast", () => div.remove());
  } else {
    // Fallback
    alert(message);
  }
}

function mapTypeToBs(type) {
  switch (type) {
    case "success":
      return "success";
    case "error":
      return "danger";
    case "warning":
      return "warning";
    default:
      return "secondary";
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
