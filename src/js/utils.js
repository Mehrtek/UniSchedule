export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) =>
  Array.from(root.querySelectorAll(sel));

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const pad2 = (n) => String(n).padStart(2, "0");

export function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return (
    "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16)
  );
}

export function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[m])
  );
}

export function hashColor(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = Math.abs(h) % 360;
  return hue;
}

export function downloadText(filename, text, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function toast(title, message, type = "info") {
  const wrap = $("#toastWrap");
  if (!wrap) return;
  const el = document.createElement("div");
  el.className = "toast";
  const dotColor =
    type === "danger"
      ? "rgba(251,113,133,0.95)"
      : type === "warn"
      ? "rgba(251,191,36,0.95)"
      : type === "ok"
      ? "rgba(52,211,153,0.95)"
      : "rgba(34,211,238,0.95)";
  el.innerHTML = `
    <div class="toast-dot" style="background:${dotColor}; box-shadow: 0 0 0 4px ${dotColor
    .replace("0.95", "0.14")
    .replace("0.9", "0.14")};"></div>
    <div class="min-w-0">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg mt-0.5">${escapeHtml(message)}</div>
    </div>
    <button class="ml-auto btn px-2.5 py-1.5 rounded-xl text-xs">Dismiss</button>
  `;
  const btn = $("button", el);
  btn.addEventListener("click", () => el.remove());
  wrap.appendChild(el);
  setTimeout(() => {
    if (el.isConnected) el.remove();
  }, 4500);
}
