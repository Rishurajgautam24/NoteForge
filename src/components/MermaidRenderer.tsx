import { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  themeVariables: {
    fontSize: "14px",
  },
});

interface MermaidRendererProps {
  chart: string;
}

export default function MermaidRenderer({ chart }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !chart.trim()) return;

    const run = async () => {
      el.innerHTML = "";

      const sourceDiv = document.createElement("div");
      sourceDiv.className = "mermaid";
      sourceDiv.textContent = chart;
      el.appendChild(sourceDiv);

      try {
        await mermaid.run({ nodes: [sourceDiv] });
      } catch (err: any) {
        el.innerHTML = `<pre class="mermaid-error">Diagram error: ${err?.message ?? err}</pre>`;
      }
    };

    run();
  }, [chart]);

  return <div className="mermaid-container" ref={containerRef} />;
}
