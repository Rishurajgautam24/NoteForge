interface ToolbarProps {
  editor: any;
}

export default function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const btn = (label: string, onClick: () => void, isActive?: boolean, title?: string) => (
    <button
      className={`fmt-btn ${isActive ? "active" : ""}`}
      onClick={onClick}
      title={title}
    >
      {label}
    </button>
  );

  return (
    <div className="fmt-ribbon">
      <div className="fmt-row">
        <span className="fmt-group">
          {btn("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), "Bold")}
          {btn("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), "Italic")}
          {btn("S", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"), "Strikethrough")}
          {btn("U", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"), "Underline")}
          {btn("H", () => editor.chain().focus().toggleHighlight().run(), editor.isActive("highlight"), "Highlight")}
        </span>

        <span className="fmt-group">
          {btn("H1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }))}
          {btn("H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
          {btn("H3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }))}
        </span>

        <span className="fmt-group">
          {btn("•", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
          {btn("1.", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
          {btn("☐", () => editor.chain().focus().toggleTaskList().run(), editor.isActive("taskList"))}
          {btn("❝", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
        </span>

        <span className="fmt-group">
          {btn("L≡", () => editor.chain().focus().setTextAlign("left").run(), editor.isActive({ textAlign: "left" }), "Align left")}
          {btn("≡C", () => editor.chain().focus().setTextAlign("center").run(), editor.isActive({ textAlign: "center" }), "Align center")}
          {btn("≡R", () => editor.chain().focus().setTextAlign("right").run(), editor.isActive({ textAlign: "right" }), "Align right")}
          {btn("≡J", () => editor.chain().focus().setTextAlign("justify").run(), editor.isActive({ textAlign: "justify" }), "Justify")}
        </span>

        <span className="fmt-group">
          {btn("🔗", () => {
            const url = prompt("Enter URL:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }, editor.isActive("link"))}
          {btn("⊞", () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
          {btn("—", () => editor.chain().focus().setHorizontalRule().run())}
        </span>
      </div>

      <div className="fmt-row">
        <span className="fmt-group">
          {btn("Σ", () => editor.chain().focus().insertContent({ type: "mathInline", attrs: { latex: "E=mc^2" } }).run())}
          {btn("ΣΣ", () => editor.chain().focus().insertContent({ type: "mathBlock", attrs: { latex: "E=mc^2" } }).run())}
        </span>

        <span className="fmt-group">
          {btn("◈F", () => editor.chain().focus().insertContent({ type: "mermaid", attrs: { chart: "graph TD\n    A --> B" } }).run())}
          {btn("◈S", () => editor.chain().focus().insertContent({ type: "mermaid", attrs: { chart: "sequenceDiagram\n    A->>B: Hello\n    B-->>A: Hi" } }).run())}
          {btn("◈C", () => editor.chain().focus().insertContent({ type: "mermaid", attrs: { chart: "classDiagram\n    class Test" } }).run())}
        </span>

        <span className="fmt-group">
          {btn("↩", () => editor.chain().focus().undo().run())}
          {btn("↪", () => editor.chain().focus().redo().run())}
        </span>
      </div>
    </div>
  );
}
