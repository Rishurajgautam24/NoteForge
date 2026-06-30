import { marked } from "marked";
import TurndownService from "turndown";
import {
  artifactPlaceholder,
  extractMarkdownArtifacts,
} from "./markdownArtifacts";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});

export function markdownToHtml(md: string): string {
  const { markdown, mermaidCharts, blockMath, inlineMath } =
    extractMarkdownArtifacts(md);

  let html = marked.parse(markdown, { async: false }) as string;

  mermaidCharts.forEach((chart, index) => {
    html = html.replaceAll(
      artifactPlaceholder("mermaid", index),
      `<div data-chart="${encodeEntities(chart)}" class="mermaid-node"></div>`
    );
  });

  blockMath.forEach((latex, index) => {
    html = html.replaceAll(
      artifactPlaceholder("blockMath", index),
      `<div data-latex="${encodeEntities(latex)}" class="math-block"></div>`
    );
  });

  inlineMath.forEach((latex, index) => {
    html = html.replaceAll(
      artifactPlaceholder("inlineMath", index),
      `<span data-latex="${encodeEntities(latex)}" class="math-inline"></span>`
    );
  });

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

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
