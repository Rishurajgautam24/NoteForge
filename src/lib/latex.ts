import { normalizeLatexDelimiters } from "./markdownArtifacts";

// Convert a NoteForge markdown note into a complete LaTeX document that compiles
// on Overleaf (pdflatex). Math is preserved verbatim; markdown structure is
// mapped to LaTeX constructs.
//
// Approach: pull out anything that must NOT be LaTeX-escaped (code + math) into
// alphanumeric placeholder tokens, transform + escape the remaining prose, then
// splice the protected fragments back in.

// Options for the LaTeX export.
export interface LatexOptions {
  // File names of pre-rendered Mermaid PNGs, in the same order the mermaid
  // fences appear in the document. When provided, each diagram is embedded via
  // \includegraphics; otherwise the diagram source is kept as a verbatim block
  // so nothing is silently dropped (the old behaviour emitted only a comment).
  mermaidFigures?: string[];
}

interface Protected {
  text: string;
  tokens: string[];
  kinds: ("blockMath" | "inlineMath" | "codeBlock" | "inlineCode" | "mermaid")[];
}

function token(i: number): string {
  // Alphanumeric only so it survives LaTeX escaping and inline-format regexes.
  return `ZZNFTOKEN${i}ZZ`;
}

function protect(source: string): Protected {
  const tokens: string[] = [];
  const kinds: Protected["kinds"] = [];
  let text = normalizeLatexDelimiters(source);

  const stash = (value: string, kind: Protected["kinds"][number]) => {
    const i = tokens.length;
    tokens.push(value);
    kinds.push(kind);
    return token(i);
  };

  // Fenced code (keep mermaid source — it is restored as a figure or a
  // verbatim block, never silently dropped).
  text = text.replace(/```(\w*)\s*\n?([\s\S]*?)```/g, (_m, lang: string, body: string) => {
    if (lang.trim().toLowerCase() === "mermaid") {
      return stash(body.replace(/\s+$/, ""), "mermaid");
    }
    return stash(body.replace(/\s+$/, ""), "codeBlock");
  });

  // Block then inline math.
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_m, tex: string) => stash(tex.trim(), "blockMath"));
  text = text.replace(/\$(?![\s$])([^\n$]*?[^\s$])\$/g, (_m, tex: string) => stash(tex.trim(), "inlineMath"));

  // Inline code.
  text = text.replace(/`([^`\n]+)`/g, (_m, code: string) => stash(code, "inlineCode"));

  return { text, tokens, kinds };
}

function escapeLatex(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function inlineFormat(s: string): string {
  // Images -> alt text (Overleaf can't fetch remote URLs). Do this before the
  // link rule so the leading "!" doesn't leak through.
  let out = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Links: the URL must NOT be LaTeX-escaped (escaped \_ \% broke \href on
  // Overleaf), so stash the whole link and re-insert it after escaping.
  const links: string[] = [];
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
    links.push(`\\href{${url}}{${escapeLatex(label)}}`);
    return `ZZNFLINK${links.length - 1}ZZ`;
  });
  out = escapeLatex(out);
  out = out.replace(/ZZNFLINK(\d+)ZZ/g, (_m, i: string) => links[parseInt(i, 10)]);
  out = out.replace(/\*\*([^*]+)\*\*/g, "\\textbf{$1}");
  out = out.replace(/\*([^*]+)\*/g, "\\textit{$1}");
  return out;
}

function restore(text: string, p: Protected, opts?: LatexOptions): string {
  let mermaidSeen = 0;
  return text.replace(/ZZNFTOKEN(\d+)ZZ/g, (_m, i: string) => {
    const idx = parseInt(i, 10);
    const value = p.tokens[idx];
    switch (p.kinds[idx]) {
      case "blockMath":
        return `\\[\n${value}\n\\]`;
      case "inlineMath":
        return `$${value}$`;
      case "inlineCode":
        return `\\texttt{${escapeLatex(value)}}`;
      case "codeBlock":
        return `\\begin{verbatim}\n${value}\n\\end{verbatim}`;
      case "mermaid": {
        const figure = opts?.mermaidFigures?.[mermaidSeen++];
        if (figure) {
          return `\\begin{center}\n\\includegraphics[width=0.9\\linewidth]{${figure}}\n\\end{center}`;
        }
        return `% Mermaid diagram — render the source below at mermaid.live, or use "Export → LaTeX (.tex + figures)" to embed it as an image.\n\\begin{verbatim}\n${value}\n\\end{verbatim}`;
      }
      default:
        return value;
    }
  });
}

const TABLE_SEP = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function tableToLatex(rows: string[], sep: string): string {
  const header = splitRow(rows[0]);
  const cols = header.length;
  const aligns = splitRow(sep).map((c) => {
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    if (left && right) return "c";
    if (right) return "r";
    return "l";
  });
  const colSpec =
    "|" +
    Array.from({ length: cols }, (_, i) => aligns[i] ?? "l").join("|") +
    "|";

  const renderRow = (cells: string[]) =>
    Array.from({ length: cols }, (_, i) => inlineFormat(cells[i] ?? "")).join(" & ") +
    " \\\\";

  const bodyRows = rows.slice(2).map((r) => `  ${renderRow(splitRow(r))}\n  \\hline`);

  return [
    "\\begin{center}",
    `\\begin{tabular}{${colSpec}}`,
    "\\hline",
    `  ${renderRow(header)}`,
    "  \\hline",
    ...bodyRows,
    "\\end{tabular}",
    "\\end{center}",
  ].join("\n");
}

function bodyToLatex(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let listStack: ("itemize" | "enumerate")[] = [];

  const closeLists = () => {
    while (listStack.length) out.push(`\\end{${listStack.pop()}}`);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, "");

    // GFM table: a header row followed by a separator row of dashes.
    if (
      /^\s*\|.*\|\s*$/.test(line) &&
      i + 1 < lines.length &&
      TABLE_SEP.test(lines[i + 1])
    ) {
      closeLists();
      const rows = [line, lines[i + 1]];
      let j = i + 2;
      while (j < lines.length && /\|/.test(lines[j]) && lines[j].trim() !== "") {
        rows.push(lines[j]);
        j++;
      }
      out.push(tableToLatex(rows, lines[i + 1]));
      i = j - 1;
      continue;
    }

    if (line.trim() === "") {
      closeLists();
      out.push("");
      continue;
    }

    // Standalone block-math token → emit as-is (restored later).
    if (/^ZZNFTOKEN\d+ZZ$/.test(line.trim())) {
      closeLists();
      out.push(line.trim());
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeLists();
      const level = heading[1].length;
      const cmd = level === 1 ? "section" : level === 2 ? "subsection" : "subsubsection";
      out.push(`\\${cmd}{${inlineFormat(heading[2])}}`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      closeLists();
      out.push("\\begin{center}\\rule{0.8\\linewidth}{0.4pt}\\end{center}");
      continue;
    }

    // GFM task items must be matched before generic bullets. The box glyphs
    // come from amssymb (already loaded); a literal `\item [ ]` would have its
    // `[ ]` swallowed as the optional \item argument.
    const task = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (task) {
      if (listStack[listStack.length - 1] !== "itemize") {
        closeLists();
        listStack.push("itemize");
        out.push("\\begin{itemize}");
      }
      const box = task[1].trim() ? "$\\boxtimes$" : "$\\square$";
      out.push(`  \\item[${box}] ${inlineFormat(task[2])}`);
      continue;
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      if (listStack[listStack.length - 1] !== "itemize") {
        closeLists();
        listStack.push("itemize");
        out.push("\\begin{itemize}");
      }
      out.push(`  \\item ${inlineFormat(ul[1])}`);
      continue;
    }

    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      if (listStack[listStack.length - 1] !== "enumerate") {
        closeLists();
        listStack.push("enumerate");
        out.push("\\begin{enumerate}");
      }
      out.push(`  \\item ${inlineFormat(ol[1])}`);
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      closeLists();
      out.push(`\\begin{quote}\n${inlineFormat(quote[1])}\n\\end{quote}`);
      continue;
    }

    closeLists();
    out.push(inlineFormat(line));
  }

  closeLists();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Full LaTeX document for Overleaf (pdflatex). */
export function markdownToLatex(md: string, opts?: LatexOptions): string {
  const p = protect(md);
  const body = restore(bodyToLatex(p.text), p, opts);
  return [
    "\\documentclass[11pt]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage[margin=1in]{geometry}",
    "\\usepackage{amsmath}",
    "\\usepackage{amssymb}",
    "\\usepackage{graphicx}",
    "\\usepackage{hyperref}",
    "\\setlength{\\parskip}{0.5em}",
    "\\setlength{\\parindent}{0pt}",
    "",
    "\\begin{document}",
    "",
    body,
    "",
    "\\end{document}",
    "",
  ].join("\n");
}
