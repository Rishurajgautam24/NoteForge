type KatexModule = typeof import("katex")["default"];
type MermaidModule = typeof import("mermaid")["default"];
type MermaidConfig = Parameters<MermaidModule["initialize"]>[0];

let katexPromise: Promise<KatexModule> | null = null;
let mermaidPromise: Promise<MermaidModule> | null = null;
let mermaidInitialized = false;
let lastMermaidConfigKey: string | null = null;

export async function loadKatex(): Promise<KatexModule> {
  if (!katexPromise) {
    katexPromise = import("katex").then((module) => module.default);
  }

  return katexPromise;
}

export async function loadMermaid(
  config?: MermaidConfig
): Promise<MermaidModule> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((module) => module.default);
  }

  const mermaid = await mermaidPromise;

  // Only (re-)initialize when the config actually changed. Every diagram used
  // to pass a config object, which re-ran initialize() on each render and
  // could blank diagrams that were mid-render elsewhere.
  const configKey = config ? JSON.stringify(config) : null;
  if (!mermaidInitialized || configKey !== lastMermaidConfigKey) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "dark",
      // The notes use HTML in node labels (<br/>, <sub>…</sub>); enable HTML
      // labels so those render instead of showing as literal text or erroring.
      htmlLabels: true,
      flowchart: { htmlLabels: true },
      ...(config ?? {}),
    });
    mermaidInitialized = true;
    lastMermaidConfigKey = configKey;
  }

  return mermaid;
}
