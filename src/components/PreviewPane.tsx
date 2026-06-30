import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import MermaidRenderer from "./MermaidRenderer";
import { isValidElement } from "react";
import { normalizeLatexDelimiters } from "../lib/markdownArtifacts";

interface PreviewPaneProps {
  content: string;
}

export default function PreviewPane({ content }: PreviewPaneProps) {
  if (!content) {
    return (
      <div className="preview-pane preview-empty">
        <p>Nothing to preview</p>
      </div>
    );
  }

  const processed = normalizeLatexDelimiters(content);

  return (
    <div className="preview-pane">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          pre({ children }: any) {
            const kids = Array.isArray(children) ? children : [children];
            const child = kids.find((c: any) => isValidElement(c)) ?? null;
            if (
              child?.type === "code" &&
              (child.props as any)?.className?.includes("language-mermaid")
            ) {
              const text = String((child.props as any).children ?? "");
              return (
                <div className="mermaid-wrapper">
                  <MermaidRenderer chart={text} />
                </div>
              );
            }
            return <pre>{children}</pre>;
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
