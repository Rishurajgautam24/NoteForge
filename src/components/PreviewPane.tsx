import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import MermaidRenderer from "./MermaidRenderer";
import { isValidElement } from "react";

interface PreviewPaneProps {
  content: string;
}

function preprocessLatex(source: string): string {
  let result = source;
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => {
    return "$$\n" + inner.trim() + "\n$$";
  });
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => {
    return "$" + inner.trim() + "$";
  });
  return result;
}

export default function PreviewPane({ content }: PreviewPaneProps) {
  if (!content) {
    return (
      <div className="preview-pane preview-empty">
        <p>Nothing to preview</p>
      </div>
    );
  }

  const processed = preprocessLatex(content);

  return (
    <div className="preview-pane">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          pre({ children }: any) {
            const child = isValidElement(children) ? children : null;
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
