import { marked } from "marked";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  convertInchesToTwip,
  WidthType,
  BorderStyle,
} from "docx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

export async function exportMarkdown(content: string, defaultName: string) {
  const path = await save({
    defaultPath: defaultName.replace(/\.md$/, "") + ".md",
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!path) return;
  await writeTextFile(path, content);
}

export async function exportDocx(markdown: string, defaultName: string) {
  const html = marked.parse(markdown, { async: false }) as string;

  const parsed = new DOMParser().parseFromString(html, "text/html");
  const children = parsed.body.children;

  const items: (Paragraph | Table)[] = [];

  for (const el of children) {
    switch (el.tagName.toLowerCase()) {
      case "h1":
        items.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
            children: runs(el.innerHTML),
          })
        );
        break;
      case "h2":
        items.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
            children: runs(el.innerHTML),
          })
        );
        break;
      case "h3":
        items.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 80 },
            children: runs(el.innerHTML),
          })
        );
        break;
      case "p":
        items.push(
          new Paragraph({
            spacing: { after: 120 },
            children: runs(el.innerHTML),
          })
        );
        break;
      case "blockquote":
        items.push(
          new Paragraph({
            spacing: { after: 120 },
            indent: { left: convertInchesToTwip(0.5) },
            children: runs(el.innerHTML, true),
          })
        );
        break;
      case "ul":
      case "ol": {
        const isOrdered = el.tagName.toLowerCase() === "ol";
        let idx = 1;
        for (const li of el.children) {
          const prefix = isOrdered ? `${idx}. ` : "• ";
          idx++;
          items.push(
            new Paragraph({
              spacing: { after: 60 },
              indent: { left: convertInchesToTwip(0.5) },
              children: [
                new TextRun({ text: prefix, bold: false }),
                ...runs(li.innerHTML),
              ],
            })
          );
        }
        break;
      }
      case "pre": {
        const code = el.textContent || "";
        items.push(
          new Paragraph({
            spacing: { before: 120, after: 120 },
            indent: { left: convertInchesToTwip(0.3) },
            children: [
              new TextRun({
                text: code,
                font: "Courier New",
                size: 20,
              }),
            ],
          })
        );
        break;
      }
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
        break;
      case "table": {
        const rows: TableRow[] = [];
        for (const tr of el.children) {
          const cells: TableCell[] = [];
          for (const td of tr.children) {
            const tag = td.tagName.toLowerCase();
            cells.push(
              new TableCell({
                children: [new Paragraph({ children: runs(td.innerHTML) })],
                width: {
                  size: 100 / tr.children.length,
                  type: WidthType.PERCENTAGE,
                },
                ...(tag === "th" ? { shading: { fill: "EEEEEE" } } : {}),
              })
            );
          }
          rows.push(new TableRow({ children: cells }));
        }
        items.push(
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        items.push(new Paragraph({ spacing: { after: 120 } }));
        break;
      }
    }
  }

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
  const html = marked.parse(markdown, { async: false }) as string;

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

  const doc = printFrame.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(printFrame);
    throw new Error("Could not create print preview");
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 1in; }
  body { font-family: 'Calibri', 'Helvetica', Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #000; padding: 40px; }
  h1 { font-size: 20pt; margin: 16pt 0 8pt; }
  h2 { font-size: 16pt; margin: 14pt 0 8pt; }
  h3 { font-size: 14pt; margin: 12pt 0 6pt; }
  p { margin: 0 0 8pt; }
  blockquote { margin: 8pt 0; padding: 4pt 12pt; border-left: 3px solid #ccc; color: #555; }
  pre { background: #f5f5f5; padding: 8pt; font-size: 10pt; border-radius: 3px; }
  code { background: #f5f5f5; padding: 1pt 4pt; font-size: 10pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th, td { border: 1px solid #ccc; padding: 4pt 8pt; text-align: left; }
  th { background: #f0f0f0; }
  img { max-width: 100%; }
  ul, ol { margin: 4pt 0; padding-left: 24pt; }
  .katex { font-size: 1.1em; }
  @media print {
    body { padding: 0; }
  }
  .print-btn { position: fixed; bottom: 24px; right: 24px; z-index: 10000; }
  .print-btn button { padding: 10px 24px; font-size: 14px; background: #c084fc; color: #000; border: none; border-radius: 6px; cursor: pointer; }
  .print-btn button:hover { background: #a855f7; }
  .close-btn { position: fixed; top: 16px; right: 16px; z-index: 10000; }
  .close-btn button { padding: 6px 16px; font-size: 13px; background: #333; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
</style>
</head>
<body>
  <div class="close-btn"><button onclick="window.parent.document.body.removeChild(window.frameElement)">Close</button></div>
  <div class="print-btn"><button onclick="window.print()">Print / Save as PDF</button></div>
  ${html}
</body>
</html>`);
  doc.close();
}

function runs(html: string, italicize?: boolean): TextRun[] {
  const result: TextRun[] = [];
  const div = document.createElement("div");
  div.innerHTML = html;
  walkTextNodes(div, result, italicize);
  return result.length ? result : [new TextRun({ text: "" })];
}

function walkTextNodes(
  parent: HTMLElement,
  result: TextRun[],
  italicize?: boolean
) {
  for (const node of parent.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text.trim()) {
        result.push(new TextRun({ text, italics: italicize }));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const bold = tag === "strong" || tag === "b";
      const italic = tag === "em" || tag === "i";
      const strike = tag === "s" || tag === "del";

      if (
        el.childNodes.length === 1 &&
        el.childNodes[0].nodeType === Node.TEXT_NODE
      ) {
        const text = el.textContent || "";
        if (text.trim()) {
          result.push(
            new TextRun({
              text,
              bold,
              italics: italic || italicize,
              strike,
              font: tag === "code" ? "Courier New" : undefined,
              size: tag === "code" ? 20 : undefined,
            })
          );
        }
      } else {
        const inner: TextRun[] = [];
        const subDiv = document.createElement("div");
        subDiv.innerHTML = el.innerHTML;
        walkTextNodes(subDiv, inner, italic || italicize);
        for (const r of inner) {
          const opts = r as any;
          result.push(
            new TextRun({
              text: opts.text || opts._text,
              bold: bold || opts.bold,
              italics: italic || opts.italics,
            })
          );
        }
      }
    }
  }
}
