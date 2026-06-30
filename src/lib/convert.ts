import { marked } from "marked";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});

export function markdownToHtml(md: string): string {
  const mermaidBlocks: string[] = [];
  const blockMath: string[] = [];
  const inlineMath: string[] = [];

  let processed = md;

  processed = processed.replace(/```mermaid\n?([\s\S]*?)```/g, (_m, chart) => {
    const idx = mermaidBlocks.length;
    mermaidBlocks.push(`<div data-chart="${encodeEntities(chart.trim())}" class="mermaid-node"></div>`);
    return `%%MERMAID_BLOCK_${idx}%%`;
  });

  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_m, latex) => {
    const idx = blockMath.length;
    blockMath.push(`<div data-latex="${encodeEntities(latex.trim())}" class="math-block"></div>`);
    return `%%BLOCK_MATH_${idx}%%`;
  });

  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_m, latex) => {
    const idx = blockMath.length;
    blockMath.push(`<div data-latex="${encodeEntities(latex.trim())}" class="math-block"></div>`);
    return `%%BLOCK_MATH_${idx}%%`;
  });

  processed = processed.replace(/\$([^\n$]*?)\$/g, (_m, latex) => {
    const idx = inlineMath.length;
    inlineMath.push(`<span data-latex="${encodeEntities(latex.trim())}" class="math-inline"></span>`);
    return `%%INLINE_MATH_${idx}%%`;
  });

  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_m, latex) => {
    const idx = inlineMath.length;
    inlineMath.push(`<span data-latex="${encodeEntities(latex.trim())}" class="math-inline"></span>`);
    return `%%INLINE_MATH_${idx}%%`;
  });

  let html = marked.parse(processed, { async: false }) as string;

  html = html.replace(/%%MERMAID_BLOCK_(\d+)%%/g, (_m, idx) => mermaidBlocks[parseInt(idx)]);
  html = html.replace(/%%BLOCK_MATH_(\d+)%%/g, (_m, idx) => blockMath[parseInt(idx)]);
  html = html.replace(/%%INLINE_MATH_(\d+)%%/g, (_m, idx) => inlineMath[parseInt(idx)]);

  return html;
}

export function htmlToMarkdown(html: string): string {
  const mermaidBlocks: string[] = [];
  const blockMath: string[] = [];
  const inlineMath: string[] = [];

  let processed = html;

  processed = processed.replace(/<div[^>]*data-chart="([^"]*)"[^>]*><\/div>/g, (_m, chart) => {
    const idx = mermaidBlocks.length;
    mermaidBlocks.push("```mermaid\n" + decodeEntities(chart) + "\n```");
    return `%%MERMAID_BLOCK_${idx}%%`;
  });

  processed = processed.replace(/<div[^>]*data-latex="([^"]*)"[^>]*><\/div>/g, (_m, latex) => {
    const idx = blockMath.length;
    blockMath.push("$$\n" + decodeEntities(latex) + "\n$$");
    return `%%BLOCK_MATH_${idx}%%`;
  });

  processed = processed.replace(/<span[^>]*data-latex="([^"]*)"[^>]*><\/span>/g, (_m, latex) => {
    const idx = inlineMath.length;
    inlineMath.push("$" + decodeEntities(latex) + "$");
    return `%%INLINE_MATH_${idx}%%`;
  });

  let md = turndown.turndown(processed);

  md = md.replace(/%%MERMAID_BLOCK_(\d+)%%/g, (_m, idx) => mermaidBlocks[parseInt(idx)]);
  md = md.replace(/%%BLOCK_MATH_(\d+)%%/g, (_m, idx) => blockMath[parseInt(idx)]);
  md = md.replace(/%%INLINE_MATH_(\d+)%%/g, (_m, idx) => inlineMath[parseInt(idx)]);

  return md;
}

function encodeEntities(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function decodeEntities(s: string): string {
  return s
    .replace(/"/g, '"')
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/&/g, "&");
}
