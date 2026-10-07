export type MarkdownArtifactKind = "mermaid" | "blockMath" | "inlineMath";

export interface ExtractedMarkdownArtifacts {
  markdown: string;
  mermaidCharts: string[];
  blockMath: string[];
  inlineMath: string[];
}

// A display-math "delimiter line" is a line whose only meaningful content is the
// non-standard `&&` fence some of our notes use (occasionally corrupted with a
// stray trailing char, e.g. `&&I`). Matching the whole line — rather than an
// inline `&&` — keeps us from touching a literal `&&` that appears in prose.
const AMP_MATH_DELIM = /^\s*&&\s*[A-Za-z0-9]?\s*$/;

/**
 * Normalise every display/inline math delimiter style found in NoteForge notes
 * to KaTeX-friendly `$$`/`$` so remark-math can parse it.
 *
 * Two things matter for correctness:
 *  1. Delimiters inside code (fenced or inline) must be left untouched.
 *  2. Every *display* block is emitted on its own lines, dedented and separated
 *     by blank lines. A `$$` block that sits flush against surrounding prose
 *     (e.g. inside a list item) can be mis-parsed and swallow the rest of the
 *     document into one giant errored formula — which is exactly the red
 *     "raw markdown" overflow we were seeing. Isolating the block prevents it.
 */
export function normalizeLatexDelimiters(source: string): string {
  const stash: string[] = [];
  const protect = (re: RegExp, s: string) =>
    s.replace(re, (m) => {
      stash.push(m);
      return `NFCODEZZ${stash.length - 1}ZZ`;
    });

  let result = source;
  result = protect(/```[\s\S]*?```/g, result); // fenced code
  result = protect(/`[^`\n]*`/g, result); // inline code

  // \[ ... \] (display) and \( ... \) (inline).
  result = result.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_match, inner: string) => `\n\n$$\n${inner.trim()}\n$$\n\n`
  );
  result = result.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_match, inner: string) => `$${inner.trim()}$`
  );

  // && ... && display blocks → isolated $$ blocks (see AMP_MATH_DELIM).
  result = normalizeAmpersandMath(result);

  result = result.replace(/NFCODEZZ(\d+)ZZ/g, (_m, i: string) => stash[Number(i)]);
  return result;
}

function normalizeAmpersandMath(source: string): string {
  if (!source.includes("&&")) return source;
  const lines = source.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (AMP_MATH_DELIM.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && !AMP_MATH_DELIM.test(lines[j])) j++;
      if (j < lines.length) {
        // Matched opening + closing fence — emit an isolated, dedented $$ block.
        const inner = lines
          .slice(i + 1, j)
          .map((l) => l.replace(/^\s+/, ""))
          .join("\n")
          .trim();
        out.push("", "", "$$", inner, "$$", "", "");
        i = j + 1;
        continue;
      }
      // No closing fence — leave the line alone rather than open a runaway block.
    }
    out.push(lines[i]);
    i++;
  }
  return out.join("\n");
}

export function extractMarkdownArtifacts(source: string): ExtractedMarkdownArtifacts {
  const mermaidCharts: string[] = [];
  const blockMath: string[] = [];
  const inlineMath: string[] = [];

  let markdown = normalizeLatexDelimiters(source);

  // Mermaid fences are code fences: extract them before stashing code, or the
  // code stash below would swallow them.
  markdown = markdown.replace(
    /```mermaid\s*\n?([\s\S]*?)```/g,
    (_match, chart: string) => {
      const index = mermaidCharts.length;
      mermaidCharts.push(chart.trim());
      return artifactPlaceholder("mermaid", index);
    }
  );

  // Stash remaining code so math inside fenced/inline code is left untouched
  // (extracting first turned `$$x^2$$` inside a ```latex fence into a stray
  // equation and corrupted the code block).
  const codeStash: string[] = [];
  const stashCode = (m: string) => {
    codeStash.push(m);
    return `NFCODEART${codeStash.length - 1}NF`;
  };
  markdown = markdown.replace(/```[\s\S]*?```/g, stashCode);
  markdown = markdown.replace(/`[^`\n]*`/g, stashCode);

  markdown = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (_match, latex: string) => {
    const index = blockMath.length;
    blockMath.push(latex.trim());
    return artifactPlaceholder("blockMath", index);
  });

  markdown = markdown.replace(/(?<!\w)\$(?![\s\d,.])\s*([^\n$]+?)\s*\$(?![\d.]|\w)/g, (_match, latex: string) => {
    const index = inlineMath.length;
    inlineMath.push(latex.trim());
    return artifactPlaceholder("inlineMath", index);
  });

  markdown = markdown.replace(/NFCODEART(\d+)NF/g, (_m, i: string) => codeStash[Number(i)]);

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
  // Alphanumeric-only: tokens with underscores (`%%...%%`) were being escaped
  // to `\_` by Turndown on the way back and corrupted every round-trip.
  return `NF${kind.toUpperCase()}ART${index}NF`;
}
