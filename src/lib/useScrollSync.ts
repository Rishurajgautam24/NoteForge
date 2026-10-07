import { useCallback, useRef } from "react";

// Two-way proportional scroll sync between the editor and the preview in split
// view.
//
// Feedback loops are suppressed per pane: whenever we programmatically set a
// pane's scrollTop we record the time, and that pane's own scroll events are
// ignored as echoes for a short window after the write. A late echo that slips
// past the window is harmless — it carries the ratio we just wrote, so syncing
// the other pane back to it is a no-op.
//
// The previous "driver latch" model failed exactly there: the latch expired
// 150ms after the last user event, and when KaTeX/Mermaid kept the main thread
// busy past that, the echo was mistaken for a user scroll and yanked the other
// pane back to a stale position.
const ECHO_WINDOW_MS = 120;
// Content-driven re-alignment yields to someone physically scrolling the
// preview: without this, the debounced re-apply fired mid-scroll and yanked
// the preview back while the user was reading. Set generously so async layout
// (Mermaid/KaTeX settling after a keystroke) doesn't snap the preview away
// from where the user is reading.
const USER_SCROLL_WINDOW_MS = 800;

export function useScrollSync() {
  const editorEl = useRef<HTMLElement | null>(null);
  const previewEl = useRef<HTMLElement | null>(null);
  const wroteAt = useRef({ editor: 0, preview: 0 });
  const userScrolledAt = useRef({ editor: 0, preview: 0 });

  const ratioOf = (el: HTMLElement) => {
    const max = el.scrollHeight - el.clientHeight;
    return max > 0 ? el.scrollTop / max : 0;
  };

  const applyRatio = (pane: "editor" | "preview", ratio: number) => {
    const el = pane === "editor" ? editorEl.current : previewEl.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const next = ratio * max;
    // Skip no-op writes so we don't emit a pointless echo scroll event.
    if (Math.abs(el.scrollTop - next) > 0.5) {
      wroteAt.current[pane] = Date.now();
      el.scrollTop = next;
    }
  };

  const onEditorScroll = useCallback(() => {
    if (!editorEl.current) return;
    if (Date.now() - wroteAt.current.editor < ECHO_WINDOW_MS) return;
    userScrolledAt.current.editor = Date.now();
    applyRatio("preview", ratioOf(editorEl.current));
  }, []);

  const onPreviewScroll = useCallback(() => {
    if (!previewEl.current) return;
    if (Date.now() - wroteAt.current.preview < ECHO_WINDOW_MS) return;
    userScrolledAt.current.preview = Date.now();
    applyRatio("editor", ratioOf(previewEl.current));
  }, []);

  // After the preview's rendered height changes (edits, async KaTeX/Mermaid
  // layout) re-align it to the editor's CURRENT position — the previous
  // lastRatio could be stale after a preview-driven scroll.
  const onPreviewContentChange = useCallback(() => {
    if (!previewEl.current || !editorEl.current) return;
    if (Date.now() - userScrolledAt.current.preview < USER_SCROLL_WINDOW_MS) return;
    applyRatio("preview", ratioOf(editorEl.current));
  }, []);

  const registerEditor = useCallback((el: HTMLElement | null) => {
    editorEl.current = el;
  }, []);
  const registerPreview = useCallback((el: HTMLElement | null) => {
    previewEl.current = el;
  }, []);

  return {
    registerEditor,
    registerPreview,
    onEditorScroll,
    onPreviewScroll,
    onPreviewContentChange,
  };
}
