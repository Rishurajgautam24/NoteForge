import { useEffect, useCallback, useState, useRef, lazy, Suspense } from "react";
import { watchImmediate, exists } from "@tauri-apps/plugin-fs";
import { useStore } from "./store/useStore";
import {
  listVault,
  readFile,
  writeFile,
  createFile,
  createDirectory,
  deleteFile,
  renameFile,
  openVaultDialog,
} from "./lib/ipc";
import Sidebar from "./components/Sidebar";
import PromptHost from "./components/PromptHost";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { showPrompt } from "./lib/prompt";
import { useScrollSync } from "./lib/useScrollSync";
import { copyText } from "./lib/clipboard";
import { createBackup } from "./lib/backupManager";
import type { FileEntry } from "./types";
import "./App.css";

const WysiwygEditor = lazy(() => import("./components/WysiwygEditor"));
const EditorPane = lazy(() => import("./components/EditorPane"));
const PreviewPane = lazy(() => import("./components/PreviewPane"));
const SearchPanel = lazy(() => import("./components/SearchPanel"));

const LS_VAULT = "noteforge:vaultPath";
const LS_FILE = "noteforge:filePath";
const LS_MODE = "noteforge:viewMode";

function App() {
  const {
    vaultPath,
    fileTree,
    activeFilePath,
    activeFileContent,
    isDirty,
    viewMode,
    setVaultPath,
    setFileTree,
    setActiveFile,
    setActiveFileContent,
    setDirty,
    setViewMode,
  } = useStore();

  const [statusText, setStatusText] = useState("No vault open");
  const [exportOpen, setExportOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [autoExpand, setAutoExpand] = useState<string | null>(null);
  const scrollSync = useScrollSync();

  // Guard so vault-watch events triggered by our own writes are ignored, and
  // refs so the watch callback never acts on stale active-file state.
  const selfWriteUntil = useRef(0);
  const activePathRef = useRef(activeFilePath);
  activePathRef.current = activeFilePath;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const lastBackupRef = useRef(0);

  const writeFileQuiet = useCallback(async (path: string, content: string) => {
    selfWriteUntil.current = Date.now() + 1500;
    await writeFile(path, content);
  }, []);

  const handleExport = useCallback(
    async (format: "md" | "docx" | "pdf" | "latex") => {
      setExportOpen(false);
      if (!activeFilePath) return;
      if (!activeFileContent.trim()) {
        setStatusText("Nothing to export — note is empty");
        return;
      }
      const name = activeFilePath.split("/").pop() || "note";
      try {
        const { exportMarkdown, exportDocx, exportPdf, exportLatex } =
          await import("./lib/export");
        if (format === "md") {
          await exportMarkdown(activeFileContent, name);
          setStatusText("Exported as Markdown ✓");
        } else if (format === "docx") {
          await exportDocx(activeFileContent, name);
          setStatusText("Exported as DOCX ✓");
        } else if (format === "latex") {
          await exportLatex(activeFileContent, name);
          setStatusText("Exported LaTeX (.tex + figures) ✓");
        } else {
          await exportPdf(activeFileContent);
          setStatusText("PDF print dialog opened");
        }
        setTimeout(() => setStatusText(`Editing: ${name}`), 2000);
      } catch (e) {
        setStatusText(`Export failed: ${e}`);
      }
    },
    [activeFilePath, activeFileContent]
  );

  const handleCopyLatex = useCallback(async () => {
    setExportOpen(false);
    if (!activeFileContent) return;
    try {
      const { copyLatexWithFigures } = await import("./lib/export");
      const base = (activeFilePath?.split(/[/\\]/).pop() ?? "note").replace(
        /\.(md|markdown|tex)$/i,
        ""
      );
      let dir = "";
      if (activeFilePath) {
        const idx = Math.max(
          activeFilePath.lastIndexOf("/"),
          activeFilePath.lastIndexOf("\\")
        );
        dir = idx >= 0 ? activeFilePath.slice(0, idx + 1) : "";
      }
      const { tex, figureCount } = await copyLatexWithFigures(
        activeFileContent,
        base,
        dir
      );
      // Copy within the click gesture (no intermediate awaits before the
      // clipboard write) so the Tauri webview doesn't reject it.
      const ok = await copyText(tex);
      const name = activeFilePath?.split(/[/\\]/).pop() ?? "note";
      const figuresNote = figureCount
        ? `; saved ${figureCount} Mermaid figure(s) (${base}-fig-N.png) next to your note — upload them to Overleaf`
        : "";
      setStatusText(ok ? `Copied LaTeX for Overleaf ✓${figuresNote}` : "Copy failed");
      setTimeout(() => setStatusText(`Editing: ${name}`), 3000);
    } catch (e) {
      setStatusText(`Copy failed: ${e}`);
    }
  }, [activeFileContent, activeFilePath]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    if (exportOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  const saveSession = useCallback(() => {
    try {
      if (vaultPath) localStorage.setItem(LS_VAULT, vaultPath);
      if (activeFilePath) localStorage.setItem(LS_FILE, activeFilePath);
      localStorage.setItem(LS_MODE, viewMode);
    } catch {}
  }, [vaultPath, activeFilePath, viewMode]);

  useEffect(() => {
    saveSession();
  }, [vaultPath, activeFilePath, viewMode, saveSession]);

  const refreshVault = useCallback(
    async (path: string) => {
      try {
        const contents = await listVault(path);
        setFileTree(contents.files);
        setVaultPath(path);
        setStatusText(`Vault: ${path.split("/").pop()}`);
      } catch (e) {
        setStatusText(`Error: ${e}`);
      }
    },
    [setFileTree, setVaultPath]
  );

  const handleOpenVault = useCallback(async () => {
    const path = await openVaultDialog();
    if (path) {
      await refreshVault(path);
    }
  }, [refreshVault]);

  const handleFileSelect = useCallback(
    async (path: string) => {
      if (isDirty && activeFilePath) {
        try {
          await writeFileQuiet(activeFilePath, activeFileContent);
        } catch {}
      }
      try {
        const content = await readFile(path);
        setActiveFile(path, content);
        setStatusText(`Editing: ${path.split("/").pop()}`);
      } catch (e) {
        setStatusText(`Error reading file: ${e}`);
      }
    },
    [isDirty, activeFilePath, activeFileContent, setActiveFile, writeFileQuiet]
  );

  const handleEditorChange = useCallback(
    (content: string) => {
      setActiveFileContent(content);
    },
    [setActiveFileContent]
  );

  const handleNewFile = useCallback(
    async (targetDir?: string) => {
      if (!vaultPath) return;
      const dir = targetDir ?? vaultPath;
      const name = await showPrompt({
        title: "New note",
        label: `Location: ${dir}`,
        value: "untitled.md",
        confirmLabel: "Create",
      });
      const safe = name ? sanitizeEntryName(name, ".md") : null;
      if (!safe) return;
      const fullPath = await uniquePath(`${dir}/${safe}`);
      try {
        await createFile(fullPath);
        setAutoExpand(dir);
        await refreshVault(vaultPath);
        await handleFileSelect(fullPath);
      } catch (e) {
        setStatusText(`Create failed: ${e}`);
      }
    },
    [vaultPath, refreshVault, handleFileSelect]
  );

  const handleNewFolder = useCallback(
    async (targetDir?: string) => {
      if (!vaultPath) return;
      const dir = targetDir ?? vaultPath;
      const name = await showPrompt({
        title: "New folder",
        label: `Location: ${dir}`,
        value: "new-folder",
        confirmLabel: "Create",
      });
      const safe = name ? sanitizeEntryName(name) : null;
      if (!safe) return;
      const fullPath = await uniquePath(`${dir}/${safe}`);
      try {
        await createDirectory(fullPath);
        setAutoExpand(dir);
        await refreshVault(vaultPath);
      } catch (e) {
        setStatusText(`Create failed: ${e}`);
      }
    },
    [vaultPath, refreshVault]
  );

  const handleRename = useCallback(
    async (entry: FileEntry) => {
      if (!vaultPath) return;
      const name = await showPrompt({
        title: "Rename",
        value: entry.name,
        confirmLabel: "Rename",
      });
      const safe = name ? sanitizeEntryName(name) : null;
      if (!safe || safe === entry.name) return;
      const parent = entry.path.slice(0, entry.path.length - entry.name.length);
      const newPath = `${parent}${safe}`;
      try {
        await renameFile(entry.path, newPath);
        if (activeFilePath === entry.path) {
          setActiveFile(newPath, activeFileContent);
          setStatusText(`Editing: ${safe}`);
        }
        await refreshVault(vaultPath);
      } catch (e) {
        setStatusText(`Rename failed: ${e}`);
      }
    },
    [vaultPath, activeFilePath, activeFileContent, setActiveFile, refreshVault]
  );

  const handleDelete = useCallback(
    async (entry: FileEntry) => {
      if (!vaultPath) return;
      const ok = await showPrompt({
        title: `Delete "${entry.name}"?`,
        label: entry.is_directory
          ? "The folder and everything inside it will be removed."
          : "This file will be removed.",
        confirmLabel: "Delete",
        danger: true,
        confirmOnly: true,
      });
      if (!ok) return;
      try {
        await deleteFile(entry.path);
        if (activeFilePath === entry.path) {
          setActiveFile(null, "");
        }
        await refreshVault(vaultPath);
        setStatusText(`Deleted ${entry.name}`);
      } catch (e) {
        setStatusText(`Delete failed: ${e}`);
      }
    },
    [vaultPath, activeFilePath, setActiveFile, refreshVault]
  );

  useEffect(() => {
    if (!isDirty || !activeFilePath) return;
    const timer = setTimeout(async () => {
      try {
        await writeFileQuiet(activeFilePath, activeFileContent);

        // Create backup every hour
        const now = Date.now();
        if (now - lastBackupRef.current > 3600000) {
          lastBackupRef.current = now;
          try {
            await createBackup(activeFilePath, activeFileContent);
          } catch {}
        }

        setDirty(false);
        setStatusText("Auto-saved ✓");
        setTimeout(
          () =>
            setStatusText(
              `Editing: ${activeFilePath.split("/").pop()}`
            ),
          1500
        );
      } catch {
        setStatusText("Auto-save failed — changes kept in editor");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isDirty, activeFilePath, activeFileContent, setDirty, writeFileQuiet]);

  // Live vault refresh: files and folders created outside the app appear in
  // the sidebar without reopening the vault. Events from our own writes are
  // skipped via the self-write window; an externally-changed active file is
  // reloaded only when it has no unsaved edits.
  useEffect(() => {
    if (!vaultPath) return;
    let disposed = false;
    let unwatch: (() => void) | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<string>();

    (async () => {
      try {
        unwatch = await watchImmediate(
          vaultPath,
          (event) => {
            if (Date.now() < selfWriteUntil.current) return;
            (event.paths ?? []).forEach((p) => pending.add(p));
            clearTimeout(debounce);
            debounce = setTimeout(async () => {
              if (disposed) return;
              try {
                const contents = await listVault(vaultPath);
                if (!disposed) setFileTree(contents.files);
                const active = activePathRef.current;
                if (active && !isDirtyRef.current && pending.has(active)) {
                  try {
                    const content = await readFile(active);
                    if (!disposed) setActiveFile(active, content);
                  } catch {}
                }
              } catch {}
              pending.clear();
            }, 300);
          },
          { recursive: true }
        );
        if (disposed) unwatch?.();
      } catch (e) {
        if (!disposed) setStatusText(`Vault watching unavailable: ${e}`);
      }
    })();

    // Fallback poll: some platforms/file systems don't reliably deliver watch
    // events (e.g. for files created by other apps), so re-list the vault on an
    // interval too. This guarantees externally-created files/folders show up
    // without reopening the vault. The active file is only reloaded on a real
    // watch event, never by the poll, so live edits are never clobbered.
    const poll = setInterval(async () => {
      if (disposed) return;
      try {
        const contents = await listVault(vaultPath);
        if (!disposed) setFileTree(contents.files);
      } catch {}
    }, 3000);

    return () => {
      disposed = true;
      unwatch?.();
      clearTimeout(debounce);
      clearInterval(poll);
    };
  }, [vaultPath, setFileTree, setActiveFile]);

  useEffect(() => {
    const savedVault = localStorage.getItem(LS_VAULT);
    const savedFile = localStorage.getItem(LS_FILE);
    const savedMode = localStorage.getItem(LS_MODE) as any;

    if (savedMode && ["edit", "preview", "split"].includes(savedMode)) {
      setViewMode(savedMode);
    }

    const restore = async () => {
      if (savedVault) {
        try {
          const contents = await listVault(savedVault);
          setFileTree(contents.files);
          setVaultPath(savedVault);
          setStatusText(`Vault: ${savedVault.split("/").pop()}`);

          if (savedFile) {
            const content = await readFile(savedFile);
            setActiveFile(savedFile, content);
            setStatusText(`Editing: ${savedFile.split("/").pop()}`);
          }
        } catch {
          setStatusText("Could not restore last session — vault or file missing");
        }
      }
    };

    restore();
  }, [setViewMode, setFileTree, setVaultPath, setActiveFile]);

  return (
    <ErrorBoundary>
      <div className="app">
        <Sidebar
          files={fileTree}
          vaultPath={vaultPath}
          activeFilePath={activeFilePath}
          onFileSelect={handleFileSelect}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onOpenVault={handleOpenVault}
          onRefresh={() => vaultPath && refreshVault(vaultPath)}
          onRename={handleRename}
          onDelete={handleDelete}
          autoExpand={autoExpand}
        />
        <div className="main-area">
        <div className="toolbar">
          <div className="toolbar-left">
            <button
              className={`toolbar-btn ${viewMode === "edit" ? "active" : ""}`}
              onClick={() => setViewMode("edit")}
            >
              Edit
            </button>
            <button
              className={`toolbar-btn ${viewMode === "split" ? "active" : ""}`}
              onClick={() => setViewMode("split")}
            >
              Split
            </button>
            <button
              className={`toolbar-btn ${viewMode === "preview" ? "active" : ""}`}
              onClick={() => setViewMode("preview")}
            >
              Preview
            </button>
          </div>
          <div className="toolbar-center">
            {activeFilePath && (
              <span className="filename">
                {activeFilePath.split("/").pop()}
                {isDirty && " ●"}
              </span>
            )}
          </div>
          <div className="toolbar-right">
            {vaultPath && (
              <button
                className="toolbar-btn"
                onClick={() => setSearchOpen(!searchOpen)}
                title="Search vault (Cmd+Shift+F)"
              >
                🔍
              </button>
            )}
            {activeFilePath && (
              <div className="export-wrap" ref={exportRef}>
                <button className="toolbar-btn" onClick={() => setExportOpen(!exportOpen)}>
                  Export ▾
                </button>
                {exportOpen && (
                  <div className="export-menu">
                    <button onClick={() => handleExport("md")}>Markdown (.md)</button>
                    <button onClick={() => handleExport("docx")}>Word (.docx)</button>
                    <button onClick={() => handleExport("pdf")}>PDF</button>
                    <button onClick={() => handleExport("latex")}>LaTeX (.tex + figures)</button>
                    <button onClick={handleCopyLatex}>Copy as LaTeX (Overleaf)</button>
                  </div>
                )}
              </div>
            )}
            <span className="status-text">{statusText}</span>
          </div>
        </div>

        {searchOpen && vaultPath && (
          <Suspense fallback={null}>
            <SearchPanel
              files={fileTree}
              onSelectFile={handleFileSelect}
              onClose={() => setSearchOpen(false)}
            />
          </Suspense>
        )}

        <div className="content-area">
          {!activeFilePath ? (
            <div className="welcome">
              <h1>NoteForge</h1>
              <p>Markdown + LaTeX + Mermaid — WYSIWYG editing</p>
              <div className="welcome-actions">
                <button className="welcome-btn" onClick={handleOpenVault}>
                  Open a vault
                </button>
                <span className="welcome-hint">
                  or create a new file from the sidebar
                </span>
              </div>
            </div>
          ) : viewMode === "edit" ? (
            <Suspense fallback={<div className="preview-pane preview-empty"><p>Loading editor...</p></div>}>
              <WysiwygEditor
                content={activeFileContent}
                onChange={handleEditorChange}
              />
            </Suspense>
          ) : viewMode === "split" ? (
            <div className="split-panes">
              <Suspense fallback={<div className="preview-pane preview-empty"><p>Loading editor...</p></div>}>
                <EditorPane
                  content={activeFileContent}
                  onChange={handleEditorChange}
                  onScroll={scrollSync.onEditorScroll}
                  registerScroller={scrollSync.registerEditor}
                />
              </Suspense>
              <Suspense fallback={<div className="preview-pane preview-empty"><p>Loading preview...</p></div>}>
                <PreviewPane
                  content={activeFileContent}
                  onScroll={scrollSync.onPreviewScroll}
                  registerScroller={scrollSync.registerPreview}
                  onContentChange={scrollSync.onPreviewContentChange}
                />
              </Suspense>
            </div>
          ) : (
            <Suspense fallback={<div className="preview-pane preview-empty"><p>Loading preview...</p></div>}>
              <PreviewPane content={activeFileContent} />
            </Suspense>
          )}
        </div>
        </div>
        <PromptHost />
      </div>
    </ErrorBoundary>
  );
}

// Vault entry names typed into the prompt dialog: strip path separators so a
// name can't escape its target folder, and make sure files keep their ext.
function sanitizeEntryName(name: string, ext?: string): string | null {
  const cleaned = name.replace(/[/\\]/g, "-").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return null;
  if (ext && !cleaned.toLowerCase().endsWith(ext)) return cleaned + ext;
  return cleaned;
}

// Append " (1)", " (2)"… when a file/folder of the same name already exists, so
// creating "untitled.md" twice augments the name instead of silently
// truncating and wiping the first note.
async function uniquePath(path: string): Promise<string> {
  try {
    if (!(await exists(path))) return path;
  } catch {
    return path;
  }
  const dot = path.lastIndexOf(".");
  const ext = dot > 0 ? path.slice(dot) : "";
  const stem = dot > 0 ? path.slice(0, dot) : path;
  let i = 1;
  const MAX_ATTEMPTS = 10000;
  for (; i <= MAX_ATTEMPTS; i++) {
    const candidate = `${stem} (${i})${ext}`;
    try {
      if (!(await exists(candidate))) return candidate;
    } catch {
      return candidate;
    }
  }
  // Fallback: use timestamp if we hit the max attempts limit
  return `${stem} (${Date.now()})${ext}`;
}

export default App;
