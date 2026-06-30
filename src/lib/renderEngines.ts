type KatexModule = typeof import("katex")["default"];
type MermaidModule = typeof import("mermaid")["default"];
type MermaidConfig = Parameters<MermaidModule["initialize"]>[0];

let katexPromise: Promise<KatexModule> | null = null;
let mermaidPromise: Promise<MermaidModule> | null = null;
let mermaidInitialized = false;

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

  if (!mermaidInitialized || config) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "dark",
      ...(config ?? {}),
    });
    mermaidInitialized = true;
  }

  return mermaid;
}
