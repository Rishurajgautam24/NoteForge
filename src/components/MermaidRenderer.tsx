import { useEffect, useRef } from "react";
import { loadMermaid } from "../lib/renderEngines";

interface MermaidRendererProps {
  chart: string;
}

export default function MermaidRenderer({ chart }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !chart.trim()) return;
    let cancelled = false;

    const run = async () => {
      const mermaid = await loadMermaid({
        theme: "dark",
        themeVariables: {
          fontSize: "14px",
        },
      });

      if (cancelled) return;

      el.innerHTML = "";

      const sourceDiv = document.createElement("div");
      sourceDiv.className = "mermaid";
      sourceDiv.textContent = chart;
      el.appendChild(sourceDiv);

      try {
        await mermaid.run({ nodes: [sourceDiv] });
      } catch (err: any) {
        if (!cancelled) {
          el.innerHTML = `<pre class="mermaid-error">Diagram error: ${err?.message ?? err}</pre>`;
        }
      }
    };

    run().catch((err: unknown) => {
      if (!cancelled) {
        el.innerHTML = `<pre class="mermaid-error">Diagram error: ${String(err)}</pre>`;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [chart]);

  return <div className="mermaid-container" ref={containerRef} />;
}
