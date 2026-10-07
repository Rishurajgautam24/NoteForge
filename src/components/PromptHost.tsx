import { useEffect, useRef } from "react";
import { usePromptStore } from "../lib/prompt";

export default function PromptHost() {
  const request = usePromptStore((s) => s.request);
  const close = usePromptStore((s) => s.close);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request || request.confirmOnly) return;
    const t = setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      // Preselect the base name (before the extension) for quick renames.
      const dot = el.value.lastIndexOf(".");
      const end = dot > 0 ? dot : el.value.length;
      el.setSelectionRange(0, end);
    }, 0);
    return () => clearTimeout(t);
  }, [request]);

  if (!request) return null;

  const submit = () => {
    if (request.confirmOnly) {
      close("confirm");
      return;
    }
    const v = inputRef.current?.value.trim();
    close(v ? v : null);
  };

  return (
    <div
      className="prompt-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close(null);
      }}
    >
      <div className="prompt-dialog">
        <div className="prompt-title">{request.title}</div>
        {request.label && <div className="prompt-label">{request.label}</div>}
        {!request.confirmOnly && (
          <input
            ref={inputRef}
            className="prompt-input"
            defaultValue={request.value ?? ""}
            placeholder={request.placeholder}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") close(null);
            }}
          />
        )}
        <div className="prompt-actions">
          <button className="prompt-btn" onClick={() => close(null)}>
            Cancel
          </button>
          <button
            className={`prompt-btn primary ${request.danger ? "danger" : ""}`}
            onClick={submit}
          >
            {request.confirmLabel ?? "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
