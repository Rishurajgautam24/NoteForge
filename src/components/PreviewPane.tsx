import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import MermaidRenderer from "./MermaidRenderer";
import {
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { normalizeLatexDelimiters } from "../lib/markdownArtifacts";
import { copyText } from "../lib/clipboard";

interface PreviewPaneProps {
  content: string;
  onScroll?: () => void;
  registerScroller?: (el: HTMLElement | null) => void;
  onContentChange?: () => void;
}

// Debounce so the whole document isn't re-parsed (KaTeX + Mermaid) on every
// keystroke, which caused visible jank/reflow in the preview pane while typing.
function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function PreviewPane({
  content,
  onScroll,
  registerScroller,
  onContentChange,
}: PreviewPaneProps) {
  const debouncedContent = useDebounced(content, 200);
  const [toast, setToast] = useState<string | null>(null);

  // Scroll container is registered with the scroll-sync controller so the
  // preview tracks the editor's position (see useScrollSync).
  const scrollRef = useRef<HTMLDivElement>(null);
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  useEffect(() => {
    registerScroller?.(scrollRef.current);
    return () => registerScroller?.(null);
  }, [registerScroller]);

  // When the rendered height changes (edited content), re-align the preview to
  // the editor's current scroll position. The ResizeObserver also catches
  // async height changes that settle later than this effect (Mermaid layout,
  // font loading), which the old rAF/250ms passes missed on long documents.
  useLayoutEffect(() => {
    onContentChangeRef.current?.();
  }, [debouncedContent]);

  const hasContent = content.length > 0;
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = contentRef.current;
    if (!hasContent || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => onContentChangeRef.current?.());
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasContent]);

  // Click any rendered formula to copy its LaTeX (for pasting into a Mathcha
  // math box). KaTeX embeds the source in an <annotation> element.
  const handleClick = useCallback(async (e: ReactMouseEvent) => {
    const katexEl = (e.target as HTMLElement).closest(".katex");
    if (!katexEl) return;
    const annotation = katexEl.querySelector(
      'annotation[encoding="application/x-tex"]'
    );
    const tex = annotation?.textContent?.trim();
    if (!tex) return;
    const ok = await copyText(tex);
    setToast(ok ? "Formula LaTeX copied ✓" : "Copy failed");
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(timer);
  }, [toast]);

  const processed = hasContent
    ? normalizeLatexDelimiters(debouncedContent)
    : "";

  // The scroll container must always stay mounted: an early return here used to
  // swap in a ref-less div, silently detaching the registered scroller and
  // killing scroll sync after any file with empty content (e.g. a fresh note).
  return (
    <div
      className="preview-pane"
      ref={scrollRef}
      onScroll={onScroll}
      onClick={handleClick}
    >
      {toast && <div className="preview-toast">{toast}</div>}
      {!hasContent ? (
        <div className="preview-empty">
          <p>Nothing to preview</p>
        </div>
      ) : (
        <div className="preview-content" ref={contentRef}>
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
            components={{
              pre({ children }: any) {
                const kids = Array.isArray(children) ? children : [children];
                const child = kids.find((c: any) => isValidElement(c)) ?? null;
                if (
                  child?.type === "code" &&
                  (child.props as any)?.className?.includes("language-mermaid")
                ) {
                  const text = String((child.props as any).children ?? "");
                  return (
                    <div className="mermaid-wrapper">
                      <MermaidRenderer chart={text} />
                    </div>
                  );
                }
                return <pre>{children}</pre>;
              },
            }}
          >
            {processed}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
