export type MarkdownArtifactKind = "mermaid" | "blockMath" | "inlineMath";

export interface ExtractedMarkdownArtifacts {
  markdown: string;
  mermaidCharts: string[];
  blockMath: string[];
  inlineMath: string[];
}

export function normalizeLatexDelimiters(source: string): string {
  let result = source;

  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, inner: string) => {
    return `$$\n${inner.trim()}\n$$`;
  });

  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, inner: string) => {
    return `$${inner.trim()}$`;
  });

  return result;
}

export function extractMarkdownArtifacts(source: string): ExtractedMarkdownArtifacts {
  const mermaidCharts: string[] = [];
  const blockMath: string[] = [];
  const inlineMath: string[] = [];

  let markdown = normalizeLatexDelimiters(source);

  markdown = markdown.replace(
    /```mermaid\s*\n?([\s\S]*?)```/g,
    (_match, chart: string) => {
      const index = mermaidCharts.length;
      mermaidCharts.push(chart.trim());
      return artifactPlaceholder("mermaid", index);
    }
  );

  markdown = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (_match, latex: string) => {
    const index = blockMath.length;
    blockMath.push(latex.trim());
    return artifactPlaceholder("blockMath", index);
  });

  markdown = markdown.replace(/\$(?![\s\d,])([^\n$]*?[^\s])\$(?!\d)/g, (_match, latex: string) => {
    const index = inlineMath.length;
    inlineMath.push(latex.trim());
    return artifactPlaceholder("inlineMath", index);
  });

  return {
    markdown,
    mermaidCharts,
    blockMath,
    inlineMath,
  };
}

export function artifactPlaceholder(
  kind: MarkdownArtifactKind,
  index: number
): string {
  return `%%NOTEFORGE_${kind.toUpperCase()}_${index}%%`;
}
