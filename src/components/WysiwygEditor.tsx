import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { Image as ImageExt } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Highlight from "@tiptap/extension-highlight";
import { NodeViewWrapper } from "@tiptap/react";
import { useCallback, useEffect, useState, useRef } from "react";
import katex from "katex";
import mermaid from "mermaid";
import { MathInline } from "../extensions/MathInline";
import { MathBlock } from "../extensions/MathBlock";
import { Mermaid as MermaidExt } from "../extensions/Mermaid";
import { markdownToHtml, htmlToMarkdown } from "../lib/convert";
import Toolbar from "./Toolbar";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
});

interface WysiwygEditorProps {
  content: string;
  onChange: (content: string) => void;
}

function MathInlineNode(props: any) {
  const latex = props.node.attrs.latex;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(latex);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    if (value.trim()) {
      props.updateAttributes({ latex: value.trim() });
    }
    setEditing(false);
  };

  const html = editing
    ? ""
    : (() => {
        try {
          return katex.renderToString(latex, { displayMode: false, throwOnError: false });
        } catch {
          return latex;
        }
      })();

  return (
    <NodeViewWrapper className="math-inline-wrapper" as="span">
      {editing ? (
        <input
          ref={inputRef}
          className="math-edit-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setValue(latex); setEditing(false); }
          }}
        />
      ) : (
        <span
          className="math-rendered"
          onClick={() => { setValue(latex); setEditing(true); }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </NodeViewWrapper>
  );
}

function MathBlockNode(props: any) {
  const latex = props.node.attrs.latex;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(latex);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    if (value.trim()) {
      props.updateAttributes({ latex: value.trim() });
    }
    setEditing(false);
  };

  const html = editing
    ? ""
    : (() => {
        try {
          return katex.renderToString(latex, { displayMode: true, throwOnError: false });
        } catch {
          return latex;
        }
      })();

  return (
    <NodeViewWrapper className="math-block-wrapper" as="div">
      {editing ? (
        <textarea
          ref={textareaRef}
          className="math-edit-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setValue(latex); setEditing(false); }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
          }}
        />
      ) : (
        <div
          className="math-rendered math-rendered-block"
          onClick={() => { setValue(latex); setEditing(true); }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </NodeViewWrapper>
  );
}

function MermaidNode(props: any) {
  const chart = props.node.attrs.chart;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(chart);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (editing || !containerRef.current || !chart) return;
    setError(null);
    containerRef.current.innerHTML = "";
    const sourceDiv = document.createElement("div");
    sourceDiv.className = "mermaid";
    sourceDiv.textContent = chart;
    containerRef.current.appendChild(sourceDiv);
    mermaid.run({ nodes: [sourceDiv] }).catch((e) => {
      setError(String(e));
    });
  }, [chart, editing]);

  const commit = () => {
    if (value.trim()) {
      props.updateAttributes({ chart: value.trim() });
    }
    setEditing(false);
  };

  return (
    <NodeViewWrapper className="mermaid-node-wrapper" as="div">
      {editing ? (
        <div className="mermaid-edit-container">
          <textarea
            ref={textareaRef}
            className="mermaid-edit-textarea"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setValue(chart); setEditing(false); }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
            }}
            rows={8}
          />
          <div className="mermaid-edit-hint">Cmd+Enter to save, Esc to cancel</div>
        </div>
      ) : (
        <div onClick={() => { setValue(chart); setEditing(true); }}>
          <div className="mermaid-rendered" ref={containerRef} />
          {error && <div className="mermaid-node-error">{error}</div>}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export default function WysiwygEditor({ content, onChange }: WysiwygEditorProps) {
  const lastContent = useRef<string | null>(null);
  const skipNextUpdate = useRef(false);

  const onUpdate = useCallback(
    ({ editor }: any) => {
      if (skipNextUpdate.current) {
        skipNextUpdate.current = false;
        return;
      }
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      lastContent.current = md;
      onChange(md);
    },
    [onChange]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Start writing..." }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      ImageExt,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      MathInline.extend({ addNodeView() { return ReactNodeViewRenderer(MathInlineNode); } }),
      MathBlock.extend({ addNodeView() { return ReactNodeViewRenderer(MathBlockNode); } }),
      MermaidExt.extend({ addNodeView() { return ReactNodeViewRenderer(MermaidNode); } }),
    ],
    onUpdate,
    editorProps: {
      attributes: {
        class: "prose-editor",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (content && lastContent.current !== content) {
      lastContent.current = content;
      try {
        skipNextUpdate.current = true;
        editor.commands.setContent(markdownToHtml(content));
      } catch (e) {
        console.error("WYSIWYG setContent error:", e);
        skipNextUpdate.current = true;
        editor.commands.setContent(`<p>${content}</p>`);
      }
    }
  }, [editor, content]);

  if (!editor) {
    return <div className="wysiwyg-editor" />;
  }

  return (
    <div className="wysiwyg-wrapper">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="wysiwyg-editor" />
    </div>
  );
}
