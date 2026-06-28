# NoteForge

A native macOS note-taking app combining **Markdown**, **LaTeX math**, and **Mermaid diagrams** in one document with WYSIWYG editing.

Built with [Tauri v2](https://v2.tauri.app) + [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org/).

## Features

- **WYSIWYG Editing** – Format text inline with a rich toolbar. See your content as it renders.
- **Markdown Source** – Raw markdown editing with CodeMirror 6 when you need it.
- **Live Preview** – Rendered view with LaTeX and Mermaid support.
- **Split View** – Edit markdown source and see the rendered preview side by side.
- **LaTeX Math** – Inline `$...$` and block `$$...$$` math rendered with KaTeX. Click rendered math to edit.
- **Mermaid Diagrams** – Embed ` ```mermaid ` code blocks rendered as diagrams. Click to edit.
- **Folder-based Vaults** – Open any folder as a vault. Files are stored as plain `.md` on disk.
- **Auto-save** – Changes are saved automatically (2s debounce).
- **Session Resume** – Reopens your last vault and file on launch.
- **Export** – Export notes as Markdown (.md), Word (.docx), or PDF.
- **Dark Theme** – Built-in dark theme optimized for long writing sessions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | [Tauri v2](https://v2.tauri.app) (Rust) |
| UI Framework | [React 19](https://react.dev) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| WYSIWYG Editor | [TipTap](https://tiptap.dev) (ProseMirror) |
| Markdown Source | [CodeMirror 6](https://codemirror.net) |
| Markdown Rendering | [react-markdown](https://github.com/remarkjs/react-markdown) |
| LaTeX Rendering | [KaTeX](https://katex.org) |
| Diagram Rendering | [Mermaid](https://mermaid.js.org) |
| State Management | [Zustand](https://github.com/pmndrs/zustand) |
| DOCX Export | [docx](https://docx.js.org) |
| Bundling | [Vite](https://vite.dev) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust toolchain](https://rustup.rs/)
- macOS (for native bundle)

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Or run as a Tauri desktop app
npx tauri dev
```

### Build

```bash
# Build the desktop app bundle
npx tauri build
```

The `.app` bundle will be at `src-tauri/target/release/bundle/macos/NoteForge.app`.

## Usage

1. Open the app — click **Open a vault** or create a new file from the sidebar.
2. Choose any folder on your Mac as your vault (notes are stored as plain `.md` files).
3. Create files and organize them in folders via the sidebar.
4. Switch between **Edit** (WYSIWYG), **Split** (source + preview), and **Preview** modes.
5. Use the formatting toolbar for bold, italic, headings, lists, tables, LaTeX, and diagrams.
6. Click on rendered math or diagrams to edit them directly.
7. Export from the **Export** dropdown in the top toolbar.

## Project Structure

```
note-forge/
├── src/
│   ├── components/       # React components
│   │   ├── WysiwygEditor.tsx  # TipTap WYSIWYG editor
│   │   ├── EditorPane.tsx     # CodeMirror source editor
│   │   ├── PreviewPane.tsx    # Rendered preview
│   │   ├── Toolbar.tsx        # Formatting toolbar
│   │   └── Sidebar.tsx        # File tree sidebar
│   ├── extensions/       # Custom TipTap extensions
│   │   ├── MathInline.ts      # Inline LaTeX node
│   │   ├── MathBlock.ts       # Block LaTeX node
│   │   └── Mermaid.ts         # Mermaid diagram node
│   ├── lib/              # Utilities
│   │   ├── convert.ts         # Markdown ↔ HTML conversion
│   │   ├── export.ts          # Export to MD/DOCX/PDF
│   │   └── ipc.ts             # Tauri IPC wrappers
│   ├── store/            # Zustand state management
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Entry point
├── src-tauri/            # Tauri/Rust backend
│   ├── src/
│   │   ├── lib.rs             # Tauri app setup
│   │   └── fs.rs              # File system commands
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── README.md
```

## License

MIT
