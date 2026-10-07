// Robust clipboard copy for the Tauri WKWebView, where `navigator.clipboard`
// frequently rejects (permission / focus / non-secure-context). We try the
// synchronous hidden-textarea + execCommand path first (runs inside the user
// gesture and works reliably in the webview), then fall back to the async API.
function execCommandCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    const active = document.activeElement as HTMLElement | null;
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    active?.focus?.();
    return ok;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (execCommandCopy(text)) return true;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}
