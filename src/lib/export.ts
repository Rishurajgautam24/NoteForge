import { marked } from "marked";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
  type ParagraphChild,
} from "docx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  artifactPlaceholder,
  extractMarkdownArtifacts,
  type ExtractedMarkdownArtifacts,
} from "./markdownArtifacts";
import { loadKatex, loadMermaid } from "./renderEngines";

const DOCX_MAX_IMAGE_WIDTH = 520;
const DOCX_MAX_INLINE_MATH_WIDTH = 240;

interface DocxImageAsset {
  data: Uint8Array;
  width: number;
  height: number;
  altText: string;
}

interface DocxRenderedAssets {
  source: ExtractedMarkdownArtifacts;
  mermaidImages: Array<DocxImageAsset | null>;
  blockMathImages: Array<DocxImageAsset | null>;
  inlineMathImages: Array<DocxImageAsset | null>;
}

interface TextStyleState {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
}

let katexCssCache: string | null = null;
let inlinedKatexCssCache: string | null = null;

async function getInlinedKatexCssText(): Promise<string> {
  if (inlinedKatexCssCache) return inlinedKatexCssCache;

  const cssText = getKatexCssText();
  const urlRegex = /url\((['"]?)([^'")]+\.(?:woff2?|ttf))\1\)/g;
  const uniqueUrls = [
    ...new Set(
      Array.from(cssText.matchAll(new RegExp(urlRegex.source, "g"))).map(
        (m) => m[2]
      )
    ),
  ];

  const fontMap = new Map<string, string>();
  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const b64 = btoa(
          Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join("")
        );
        const ext = url.split(".").pop()?.toLowerCase() ?? "woff2";
        const mime =
          ext === "woff2" ? "font/woff2" : ext === "woff" ? "font/woff" : "font/ttf";
        fontMap.set(url, `data:${mime};base64,${b64}`);
      } catch {
        // keep original URL on failure
      }
    })
  );

  let result = cssText;
  for (const [url, dataUri] of fontMap) {
    result = result.split(url).join(dataUri);
  }

  inlinedKatexCssCache = result;
  return result;
}

export async function exportMarkdown(content: string, defaultName: string) {
  const path = await save({
    defaultPath: defaultName.replace(/\.md$/, "") + ".md",
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!path) return;
  await writeTextFile(path, content);
}

export async function exportDocx(markdown: string, defaultName: string) {
  const extracted = extractMarkdownArtifacts(markdown);
  const assets = await renderDocxAssets(extracted);

  let html = marked.parse(extracted.markdown, { async: false }) as string;

  extracted.mermaidCharts.forEach((_chart, index) => {
    html = replaceBlockPlaceholder(
      html,
      artifactPlaceholder("mermaid", index),
      `<div data-docx-mermaid="${index}"></div>`
    );
  });

  extracted.blockMath.forEach((_latex, index) => {
    html = replaceBlockPlaceholder(
      html,
      artifactPlaceholder("blockMath", index),
      `<div data-docx-block-math="${index}"></div>`
    );
  });

  extracted.inlineMath.forEach((_latex, index) => {
    html = html.replaceAll(
      artifactPlaceholder("inlineMath", index),
      `<span data-docx-inline-math="${index}"></span>`
    );
  });

  const parsed = new DOMParser().parseFromString(html, "text/html");
  const items = buildDocxItems(parsed.body, assets);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 24 },
        },
      },
    },
    sections: [{ children: items }],
  });

  const blob = await Packer.toBlob(doc);
  const buffer = await blob.arrayBuffer();

  const path = await save({
    defaultPath: defaultName.replace(/\.md$/, "") + ".docx",
    filters: [{ name: "Word Document", extensions: ["docx"] }],
  });
  if (!path) return;
  await writeFile(path, new Uint8Array(buffer));
}

export async function exportPdf(markdown: string) {
  const extracted = extractMarkdownArtifacts(markdown);
  let html = marked.parse(extracted.markdown, { async: false }) as string;

  const [katex, mermaid] = await Promise.all([loadKatex(), loadMermaid({ theme: "default" })]);

  for (let index = 0; index < extracted.mermaidCharts.length; index++) {
    try {
      const { svg } = await mermaid.render(
        `mermaid-pdf-${index}-${crypto.randomUUID()}`,
        extracted.mermaidCharts[index]
      );
      const replacement = `<div class="mermaid-wrapper">${svg}</div>`;
      html = replaceBlockPlaceholder(
        html,
        artifactPlaceholder("mermaid", index),
        replacement
      );
    } catch {
      const fallback = `<pre style="border:1px solid #ccc;padding:8pt;font-family:monospace;white-space:pre-wrap">${escapeHtml(
        extracted.mermaidCharts[index]
      )}</pre>`;
      html = replaceBlockPlaceholder(
        html,
        artifactPlaceholder("mermaid", index),
        fallback
      );
    }
  }

  for (let index = 0; index < extracted.blockMath.length; index++) {
    try {
      const rendered = katex.renderToString(extracted.blockMath[index], {
        displayMode: true,
        throwOnError: false,
      });
      html = replaceBlockPlaceholder(
        html,
        artifactPlaceholder("blockMath", index),
        `<div class="katex-block">${rendered}</div>`
      );
    } catch {
      html = replaceBlockPlaceholder(
        html,
        artifactPlaceholder("blockMath", index),
        `<div style="text-align:center;font-family:monospace;padding:8pt">$$${escapeHtml(
          extracted.blockMath[index]
        )}$$</div>`
      );
    }
  }

  for (let index = 0; index < extracted.inlineMath.length; index++) {
    try {
      const rendered = katex.renderToString(extracted.inlineMath[index], {
        displayMode: false,
        throwOnError: false,
      });
      html = html.replaceAll(artifactPlaceholder("inlineMath", index), rendered);
    } catch {
      html = html.replaceAll(
        artifactPlaceholder("inlineMath", index),
        `<span class="katex-error">$${escapeHtml(extracted.inlineMath[index])}$</span>`
      );
    }
  }

  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.top = "0";
  printFrame.style.width = "100%";
  printFrame.style.height = "100%";
  printFrame.style.border = "none";
  printFrame.style.zIndex = "9999";
  printFrame.style.backgroundColor = "#fff";
  document.body.appendChild(printFrame);

  const iDoc = printFrame.contentWindow?.document;
  if (!iDoc) {
    document.body.removeChild(printFrame);
    throw new Error("Could not create print preview");
  }

  const cleanup = () => {
    if (printFrame.parentNode) {
      printFrame.parentNode.removeChild(printFrame);
    }
    document.removeEventListener("keydown", handleKeydown);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      cleanup();
    }
  };

  const katexCssText = escapeStyleText(getKatexCssText());
  const iframeHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>${katexCssText}</style>
<style>
  @page { size: A4; margin: 1in; }
  html, body { background: #fff !important; color: #000 !important; }
  body { margin: 0; font-family: 'Calibri', 'Helvetica', Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #000; padding: 40px; }
  h1 { font-size: 20pt; margin: 16pt 0 8pt; }
  h2 { font-size: 16pt; margin: 14pt 0 8pt; }
  h3 { font-size: 14pt; margin: 12pt 0 6pt; }
  p { margin: 0 0 8pt; }
  blockquote { margin: 8pt 0; padding: 4pt 12pt; border-left: 3px solid #ccc; color: #555; }
  pre { background: #f5f5f5; padding: 8pt; font-size: 10pt; border-radius: 3px; white-space: pre-wrap; }
  code { background: #f5f5f5; padding: 1pt 4pt; font-size: 10pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th, td { border: 1px solid #ccc; padding: 4pt 8pt; text-align: left; }
  th { background: #f0f0f0; }
  img { max-width: 100%; }
  ul, ol { margin: 4pt 0; padding-left: 24pt; }
  .mermaid-wrapper { text-align: center; margin: 12pt 0; }
  .mermaid-wrapper svg { max-width: 100%; height: auto; }
  .katex-block { text-align: center; margin: 12pt 0; }

  @media print { body { padding: 0; } .print-btn, .close-btn { display: none; } }
  .print-btn { position: fixed; bottom: 24px; right: 24px; z-index: 10000; }
  .print-btn button { padding: 10px 24px; font-size: 14px; background: #c084fc; color: #000; border: none; border-radius: 6px; cursor: pointer; }
  .print-btn button:hover { background: #a855f7; }
  .close-btn { position: fixed; top: 16px; right: 16px; z-index: 10000; }
  .close-btn button { padding: 6px 16px; font-size: 13px; background: #333; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
</style>
</head>
<body>
  <div class="close-btn"><button type="button" data-export-close>Close</button></div>
  <div class="print-btn"><button type="button" data-export-print>Print / Save as PDF</button></div>
  <div id="content">${html}</div>
</body>
</html>`;

  document.addEventListener("keydown", handleKeydown);

  const bindFrameControls = () => {
    const frameDoc = printFrame.contentWindow?.document;
    const frameWin = printFrame.contentWindow;
    if (!frameDoc) {
      return;
    }

    const closeButton =
      frameDoc.querySelector<HTMLButtonElement>("[data-export-close]");
    const printButton =
      frameDoc.querySelector<HTMLButtonElement>("[data-export-print]");

    closeButton?.addEventListener("click", cleanup);
    printButton?.addEventListener("click", () => {
      frameWin?.focus();
      frameWin?.print();
    });
  };

  printFrame.addEventListener("load", bindFrameControls, { once: true });
  printFrame.srcdoc = iframeHtml;
}

function buildDocxItems(
  body: HTMLElement,
  assets: DocxRenderedAssets
): Array<Paragraph | Table> {
  const items: Array<Paragraph | Table> = [];

  for (const element of Array.from(body.children)) {
    appendDocxBlock(element, items, assets);
  }

  return items;
}

function appendDocxBlock(
  element: Element,
  items: Array<Paragraph | Table>,
  assets: DocxRenderedAssets
) {
  const tag = element.tagName.toLowerCase();

  if (tag === "div" && element.hasAttribute("data-docx-mermaid")) {
    const index = Number(element.getAttribute("data-docx-mermaid"));
    items.push(
      createBlockAssetParagraph(
        assets.mermaidImages[index],
        `\`\`\`mermaid\n${assets.source.mermaidCharts[index] ?? ""}\n\`\`\``
      )
    );
    return;
  }

  if (tag === "div" && element.hasAttribute("data-docx-block-math")) {
    const index = Number(element.getAttribute("data-docx-block-math"));
    items.push(
      createBlockAssetParagraph(
        assets.blockMathImages[index],
        `$$${assets.source.blockMath[index] ?? ""}$$`
      )
    );
    return;
  }

  switch (tag) {
    case "h1":
      items.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
          children: ensureParagraphChildren(paragraphChildrenFromNode(element, assets)),
        })
      );
      return;
    case "h2":
      items.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: ensureParagraphChildren(paragraphChildrenFromNode(element, assets)),
        })
      );
      return;
    case "h3":
      items.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 },
          children: ensureParagraphChildren(paragraphChildrenFromNode(element, assets)),
        })
      );
      return;
    case "p":
      items.push(
        new Paragraph({
          spacing: { after: 120 },
          children: ensureParagraphChildren(paragraphChildrenFromNode(element, assets)),
        })
      );
      return;
    case "blockquote":
      items.push(
        new Paragraph({
          spacing: { after: 120 },
          indent: { left: convertInchesToTwip(0.5) },
          children: ensureParagraphChildren(
            paragraphChildrenFromNode(element, assets, { italics: true })
          ),
        })
      );
      return;
    case "ul":
    case "ol":
      appendDocxList(element, items, assets, tag === "ol", 0);
      return;
    case "pre":
      items.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          indent: { left: convertInchesToTwip(0.3) },
          children: [
            new TextRun({
              text: element.textContent ?? "",
              font: "Courier New",
              size: 20,
            }),
          ],
        })
      );
      return;
    case "hr":
      items.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: "999999",
            },
          },
        })
      );
      return;
    case "table":
      items.push(buildDocxTable(element as HTMLTableElement, assets));
      items.push(new Paragraph({ spacing: { after: 120 } }));
      return;
    default:
      if (element.childElementCount > 0) {
        for (const child of Array.from(element.children)) {
          appendDocxBlock(child, items, assets);
        }
      }
  }
}

function appendDocxList(
  listEl: Element,
  items: Array<Paragraph | Table>,
  assets: DocxRenderedAssets,
  ordered: boolean,
  depth: number
) {
  let itemIndex = 0;
  for (const li of Array.from(listEl.children)) {
    if (li.tagName.toLowerCase() !== "li") continue;
    itemIndex++;
    const prefix = ordered ? `${itemIndex}. ` : "• ";

    const inlineChildren: ParagraphChild[] = [];
    const nestedLists: Element[] = [];

    for (const child of Array.from(li.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const t = el.tagName.toLowerCase();
        if (t === "ul" || t === "ol") {
          nestedLists.push(el);
        } else {
          inlineChildren.push(...paragraphChildrenFromNode(el, assets));
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = normalizeTextNode(child.textContent ?? "");
        if (text.trim()) inlineChildren.push(createTextRun(text, {}));
      }
    }

    items.push(
      new Paragraph({
        spacing: { after: 60 },
        indent: { left: convertInchesToTwip(0.5 + depth * 0.25) },
        children: ensureParagraphChildren([
          new TextRun({ text: prefix }),
          ...inlineChildren,
        ]),
      })
    );

    for (const nested of nestedLists) {
      appendDocxList(
        nested,
        items,
        assets,
        nested.tagName.toLowerCase() === "ol",
        depth + 1
      );
    }
  }
}

function paragraphChildrenFromNode(
  parent: ParentNode,
  assets: DocxRenderedAssets,
  style: TextStyleState = {}
): ParagraphChild[] {
  const result: ParagraphChild[] = [];

  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeTextNode(node.textContent ?? "", style.code);
      if (text.length > 0) {
        result.push(createTextRun(text, style));
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (tag === "br") {
      result.push(new TextRun({ break: 1 }));
      continue;
    }

    if (tag === "span" && element.hasAttribute("data-docx-inline-math")) {
      const index = Number(element.getAttribute("data-docx-inline-math"));
      const asset = assets.inlineMathImages[index];
      if (asset) {
        result.push(createImageRun(asset));
      } else {
        result.push(createTextRun(`$${assets.source.inlineMath[index] ?? ""}$`, style));
      }
      continue;
    }

    if (tag === "a") {
      const href = (element as HTMLAnchorElement).href;
      const linkChildren = paragraphChildrenFromNode(element, assets, style);
      const textRuns = linkChildren.filter((c): c is TextRun => c instanceof TextRun);
      if (href && textRuns.length > 0) {
        result.push(new ExternalHyperlink({ link: href, children: textRuns }));
      } else {
        result.push(...linkChildren);
      }
      continue;
    }

    if (tag === "img") {
      const alt = (element as HTMLImageElement).alt;
      if (alt) result.push(createTextRun(`[Image: ${alt}]`, style));
      continue;
    }

    const nextStyle: TextStyleState = {
      bold: style.bold || tag === "strong" || tag === "b",
      italics: style.italics || tag === "em" || tag === "i",
      strike: style.strike || tag === "s" || tag === "del",
      code: style.code || tag === "code",
    };

    result.push(...paragraphChildrenFromNode(element, assets, nextStyle));
  }

  return result;
}

function buildDocxTable(
  table: HTMLTableElement,
  assets: DocxRenderedAssets
): Table {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) => {
    const cells = Array.from(row.children).map((cell) => {
      const tag = cell.tagName.toLowerCase();
      return new TableCell({
        children: [
          new Paragraph({
            children: ensureParagraphChildren(paragraphChildrenFromNode(cell, assets)),
          }),
        ],
        width: {
          size: 100 / Math.max(row.children.length, 1),
          type: WidthType.PERCENTAGE,
        },
        ...(tag === "th" ? { shading: { fill: "EEEEEE" } } : {}),
      });
    });

    return new TableRow({ children: cells });
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function createBlockAssetParagraph(
  asset: DocxImageAsset | null,
  fallbackText = ""
): Paragraph {
  if (!asset) {
    return new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [
        new TextRun({
          text: fallbackText,
          font: "Courier New",
          size: 20,
        }),
      ],
    });
  }

  return new Paragraph({
    spacing: { before: 120, after: 120 },
    alignment: AlignmentType.CENTER,
    children: [createImageRun(asset)],
  });
}

function createImageRun(asset: DocxImageAsset): ImageRun {
  return new ImageRun({
    type: "png",
    data: asset.data,
    transformation: {
      width: asset.width,
      height: asset.height,
    },
    altText: {
      title: asset.altText,
      description: asset.altText,
      name: asset.altText,
    },
  });
}

function createTextRun(text: string, style: TextStyleState): TextRun {
  return new TextRun({
    text,
    bold: style.bold,
    italics: style.italics,
    strike: style.strike,
    font: style.code ? "Courier New" : undefined,
    size: style.code ? 20 : undefined,
  });
}

function ensureParagraphChildren(children: ParagraphChild[]): ParagraphChild[] {
  return children.length > 0 ? children : [new TextRun({ text: "" })];
}

function normalizeTextNode(text: string, preserveWhitespace = false): string {
  if (!preserveWhitespace) {
    return text.replace(/\s+/g, " ");
  }

  return text.replace(/\r/g, "");
}

async function renderDocxAssets(
  source: ExtractedMarkdownArtifacts
): Promise<DocxRenderedAssets> {
  const [mermaidImages, blockMathImages, inlineMathImages] = await Promise.all([
    Promise.all(source.mermaidCharts.map((chart) => renderMermaidAsset(chart))),
    Promise.all(source.blockMath.map((latex) => renderKatexAsset(latex, true))),
    Promise.all(source.inlineMath.map((latex) => renderKatexAsset(latex, false))),
  ]);

  return {
    source,
    mermaidImages,
    blockMathImages,
    inlineMathImages,
  };
}

async function renderMermaidAsset(chart: string): Promise<DocxImageAsset | null> {
  try {
    const mermaid = await loadMermaid({ theme: "default" });
    const { svg } = await mermaid.render(
      `mermaid-docx-${crypto.randomUUID()}`,
      chart
    );
    const { width, height } = getSvgDimensions(svg);
    const scaled = scaleToFit(width, height, DOCX_MAX_IMAGE_WIDTH);
    const data = await rasterizeSvgToPng(svg, scaled.width, scaled.height);
    return {
      data,
      width: scaled.width,
      height: scaled.height,
      altText: "Mermaid diagram",
    };
  } catch {
    return null;
  }
}

async function renderKatexAsset(
  latex: string,
  displayMode: boolean
): Promise<DocxImageAsset | null> {
  try {
    const katex = await loadKatex();
    const rendered = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
    });

    const tagName = displayMode ? "div" : "span";
    const wrapper = document.createElement(tagName);
    wrapper.innerHTML = rendered;
    wrapper.style.position = "fixed";
    wrapper.style.left = "-10000px";
    wrapper.style.top = "0";
    wrapper.style.display = displayMode ? "block" : "inline-block";
    wrapper.style.padding = "0";
    wrapper.style.margin = "0";
    wrapper.style.color = "#000";
    wrapper.style.background = "#fff";
    document.body.appendChild(wrapper);

    const rect = wrapper.getBoundingClientRect();
    const measuredWidth = Math.max(1, Math.ceil(rect.width));
    const measuredHeight = Math.max(1, Math.ceil(rect.height));

    const inlinedCss = await getInlinedKatexCssText();
    const foreignObjectSvg = createHtmlSvg(
      wrapper.innerHTML,
      measuredWidth,
      measuredHeight,
      wrapper.tagName.toLowerCase(),
      inlinedCss
    );

    document.body.removeChild(wrapper);

    const maxWidth = displayMode ? DOCX_MAX_IMAGE_WIDTH : DOCX_MAX_INLINE_MATH_WIDTH;
    const scaled = scaleToFit(measuredWidth, measuredHeight, maxWidth);
    const data = await rasterizeSvgToPng(
      foreignObjectSvg,
      scaled.width,
      scaled.height
    );

    return {
      data,
      width: scaled.width,
      height: scaled.height,
      altText: displayMode ? "Rendered equation" : "Inline equation",
    };
  } catch {
    return null;
  }
}

function getKatexCssText(): string {
  if (katexCssCache) {
    return katexCssCache;
  }

  const rules: string[] = [
    "body { margin: 0; padding: 0; color: #000; }",
    ".docx-katex-root { display: inline-block; background: #fff; color: #000; }",
  ];

  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue;
    }

    const relevant = Array.from(cssRules).filter((rule) => {
      return rule.cssText.includes(".katex") || rule.cssText.includes("KaTeX_");
    });

    if (relevant.length === 0) {
      continue;
    }

    const baseHref = sheet.href ?? window.location.href;
    relevant.forEach((rule) => {
      rules.push(absolutizeCssUrls(rule.cssText, baseHref));
    });
  }

  katexCssCache = rules.join("\n");
  return katexCssCache;
}

function createHtmlSvg(
  innerHtml: string,
  width: number,
  height: number,
  tagName: string,
  cssText: string
): string {
  const escapedCss = cssText.replace(/<\/style/gi, "<\\/style");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" class="docx-katex-root">
      <style>${escapedCss}</style>
      <${tagName}>${innerHtml}</${tagName}>
    </div>
  </foreignObject>
</svg>`;
}

function getSvgDimensions(svg: string): { width: number; height: number } {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = parsed.documentElement;

  const width = parseSvgLength(root.getAttribute("width"));
  const height = parseSvgLength(root.getAttribute("height"));

  if (width && height) {
    return { width, height };
  }

  const viewBox = root.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map((value) => Number(value));
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  return { width: DOCX_MAX_IMAGE_WIDTH, height: 240 };
}

function parseSvgLength(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function scaleToFit(
  width: number,
  height: number,
  maxWidth: number
): { width: number; height: number } {
  if (width <= maxWidth) {
    return {
      width: Math.round(width),
      height: Math.max(1, Math.round(height)),
    };
  }

  const ratio = maxWidth / width;
  return {
    width: Math.round(width * ratio),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function rasterizeSvgToPng(
  svg: string,
  width: number,
  height: number
): Promise<Uint8Array> {
  const image = await loadImageFromSvg(svg);
  const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas);
  return new Uint8Array(await blob.arrayBuffer());
}

async function loadImageFromSvg(svg: string): Promise<HTMLImageElement> {
  const blob = new Blob([svg], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load SVG"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Could not create PNG blob"));
    }, "image/png");
  });
}

function replaceBlockPlaceholder(
  html: string,
  placeholder: string,
  replacement: string
): string {
  return html
    .replaceAll(`<p>${placeholder}</p>`, replacement)
    .replaceAll(placeholder, replacement);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeStyleText(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

function absolutizeCssUrls(cssText: string, baseHref: string): string {
  return cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (_match, quote, rawUrl) => {
    if (
      rawUrl.startsWith("data:") ||
      rawUrl.startsWith("http:") ||
      rawUrl.startsWith("https:") ||
      rawUrl.startsWith("blob:") ||
      rawUrl.startsWith("/")
    ) {
      return `url(${quote}${rawUrl}${quote})`;
    }

    return `url(${quote}${new URL(rawUrl, baseHref).href}${quote})`;
  });
}
