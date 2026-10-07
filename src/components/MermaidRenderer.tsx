import { useEffect, useRef, useState } from "react";
import { loadMermaid } from "../lib/renderEngines";

interface MermaidRendererProps {
  chart: string;
}

// Monotonic id so every render() call gets a unique DOM id. Mermaid injects a
// <style> keyed on this id and reuses ids collide into blank/duplicated
// diagrams, so it must never repeat within a session.
let mermaidSeq = 0;

export default function MermaidRenderer({ chart }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !chart.trim()) return;
    let cancelled = false;

    const run = async () => {
      const mermaid = await loadMermaid({
        theme: "dark",
        themeVariables: { fontSize: "14px" },
      });
      if (cancelled) return;

      const id = `nf-mermaid-${mermaidSeq++}`;
      try {
        // render() parses + lays out off-DOM and hands back an SVG string. This
        // avoids the run()/data-processed race that left stale or blank
        // diagrams when React re-rendered the node.
        const { svg, bindFunctions } = await mermaid.render(id, chart);
        if (cancelled) return;
        el.innerHTML = svg;
        bindFunctions?.(el);
        setError(null);
      } catch (err: any) {
        // render() can leave an orphaned error node appended to <body>; remove
        // it so failed diagrams don't accumulate stray SVGs in the document.
        document.getElementById(id)?.remove();
        document.getElementById(`d${id}`)?.remove();
        if (!cancelled) setError(err?.message ?? String(err));
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  return (
    <div className="mermaid-container">
      <div ref={containerRef} style={{ display: error ? "none" : undefined }} />
      {error && <pre className="mermaid-error">Diagram error: {error}</pre>}
    </div>
  );
}
