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

// GFM task-list items: without this rule Turndown drops the checkbox entirely
// and `- [ ] task` degrades to a plain bullet on every WYSIWYG round-trip.
turndown.addRule("taskItemCheckbox", {
  filter: (node: Node) =>
    node.nodeName === "INPUT" &&
    (node as HTMLInputElement).getAttribute?.("type") === "checkbox",
  replacement: (_content: string, node: Node) =>
    (node as HTMLInputElement).hasAttribute("checked") ? "[x] " : "[ ] ",
});

// Tiptap wraps task text in <li><label>…</label><div><p>…</p></div></li>; left
// alone the label and the div blockify separately, putting the checkbox and the
// text on different lines. Flatten the div so both stay on the item line.
turndown.addRule("taskItemContent", {
  filter: (node: Node) => {
    const parent = node.parentElement;
    const grandparent = parent?.parentElement;
    return (
      node.nodeName === "DIV" &&
      parent?.nodeName === "LI" &&
      grandparent?.getAttribute?.("data-type") === "taskList"
    );
  },
  replacement: (content: string) => content.replace(/\s+/g, " ").trim(),
});

// Round-trip tokens for mermaid/math blocks. Alphanumeric-only so neither
// marked nor Turndown escapes them (underscores in the old `%%A_B%%` tokens
// became `\_` and the restore regexes never matched, destroying diagrams and
// equations on every save).
const mermaidToken = (i: number) => `NFMERMAIDTOK${i}NF`;
const blockMathToken = (i: number) => `NFBLOCKMATHTOK${i}NF`;
const inlineMathToken = (i: number) => `NFINLINEMATHTOK${i}NF`;

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

  // Block artifacts are swapped for a token wrapped in its own <p>: a bare
  // token div is passed through Turndown with no block separation, so adjacent
  // divs would collapse onto one line and the restored fence would splice into
  // surrounding text. A paragraph always ends up on its own line.
  processed = processed.replace(/<div[^>]*data-chart="([^"]*)"[^>]*><\/div>/g, (_m, chart) => {
    const idx = mermaidBlocks.length;
    mermaidBlocks.push("```mermaid\n" + decodeEntities(chart) + "\n```");
    return `<p>${mermaidToken(idx)}</p>`;
  });

  processed = processed.replace(/<div[^>]*data-latex="([^"]*)"[^>]*><\/div>/g, (_m, latex) => {
    const idx = blockMath.length;
    blockMath.push("$$\n" + decodeEntities(latex) + "\n$$");
    return `<p>${blockMathToken(idx)}</p>`;
  });

  processed = processed.replace(/<span[^>]*data-latex="([^"]*)"[^>]*><\/span>/g, (_m, latex) => {
    const idx = inlineMath.length;
    inlineMath.push("$" + decodeEntities(latex) + "$");
    return inlineMathToken(idx);
  });

  let md = turndown.turndown(processed);

  md = md.replace(/NFMERMAIDTOK(\d+)NF/g, (_m, idx) => mermaidBlocks[parseInt(idx)]);
  md = md.replace(/NFBLOCKMATHTOK(\d+)NF/g, (_m, idx) => blockMath[parseInt(idx)]);
  md = md.replace(/NFINLINEMATHTOK(\d+)NF/g, (_m, idx) => inlineMath[parseInt(idx)]);

  // Normalize Turndown's `-   [x]  task` spacing to the canonical GFM form.
  md = md.replace(/^(\s*)[-*+][ \t]+(\[[ xX]\][ \t]*)/gm, (_m, indent: string, box: string) =>
    `${indent}- ${box.replace(/\s+/g, " ").trimEnd()} `
  );

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
