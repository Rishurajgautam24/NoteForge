export function detectContentTypes(source: string): {
  hasLatex: boolean;
  hasMermaid: boolean;
} {
  const hasLatex = /\$\$[\s\S]*?\$\$/.test(source) || /\$[^\n$]*?\$/.test(source);
  const hasMermaid = /```mermaid[\s\S]*?```/.test(source);
  return { hasLatex, hasMermaid };
}

export function extractMermaidBlocks(source: string): string[] {
  const blocks: string[] = [];
  const regex = /```mermaid\n?([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}
