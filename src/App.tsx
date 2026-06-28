import { useEffect, useCallback, useState, useRef } from "react";
import { useStore } from "./store/useStore";
import {
  listVault,
  readFile,
  writeFile,
  createFile,
  createDirectory,
  openVaultDialog,
} from "./lib/ipc";
import { exportMarkdown, exportDocx, exportPdf } from "./lib/export";
import Sidebar from "./components/Sidebar";
import WysiwygEditor from "./components/WysiwygEditor";
import EditorPane from "./components/EditorPane";
import PreviewPane from "./components/PreviewPane";
import "./App.css";

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
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(
    async (format: "md" | "docx" | "pdf") => {
      setExportOpen(false);
      if (!activeFilePath || !activeFileContent) return;
      const name = activeFilePath.split("/").pop() || "note";
      try {
        if (format === "md") {
          await exportMarkdown(activeFileContent, name);
          setStatusText("Exported as Markdown ✓");
        } else if (format === "docx") {
          await exportDocx(activeFileContent, name);
          setStatusText("Exported as DOCX ✓");
        } else {
          exportPdf(activeFileContent);
          setStatusText("PDF print dialog opened");
        }
        setTimeout(() => setStatusText(`Editing: ${name}`), 2000);
      } catch (e) {
        setStatusText(`Export failed: ${e}`);
      }
    },
    [activeFilePath, activeFileContent]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    if (exportOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

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
          await writeFile(activeFilePath, activeFileContent);
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
    [isDirty, activeFilePath, activeFileContent, setActiveFile]
  );

  const handleEditorChange = useCallback(
    (content: string) => {
      setActiveFileContent(content);
    },
    [setActiveFileContent]
  );

  const handleNewFile = useCallback(async () => {
    if (!vaultPath) return;
    const name = `note-${Date.now()}.md`;
    const fullPath = `${vaultPath}/${name}`;
    await createFile(fullPath);
    await refreshVault(vaultPath);
    await handleFileSelect(fullPath);
  }, [vaultPath, refreshVault, handleFileSelect]);

  const handleNewFolder = useCallback(async () => {
    if (!vaultPath) return;
    const name = `folder-${Date.now()}`;
    const fullPath = `${vaultPath}/${name}`;
    await createDirectory(fullPath);
    await refreshVault(vaultPath);
  }, [vaultPath, refreshVault]);

  useEffect(() => {
    if (!isDirty || !activeFilePath) return;
    const timer = setTimeout(async () => {
      try {
        await writeFile(activeFilePath, activeFileContent);
        setDirty(false);
        setStatusText("Auto-saved ✓");
        setTimeout(
          () =>
            setStatusText(
              `Editing: ${activeFilePath.split("/").pop()}`
            ),
          1500
        );
      } catch {}
    }, 2000);
    return () => clearTimeout(timer);
  }, [isDirty, activeFilePath, activeFileContent, setDirty]);

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
        } catch {}
      }
    };

    restore();
  }, []);

  return (
    <div className="app">
      <div className="sidebar">
        <Sidebar
          files={fileTree}
          vaultPath={vaultPath}
          activeFilePath={activeFilePath}
          onFileSelect={handleFileSelect}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onOpenVault={handleOpenVault}
        />
      </div>
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
                  </div>
                )}
              </div>
            )}
            <span className="status-text">{statusText}</span>
          </div>
        </div>

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
            <WysiwygEditor
              content={activeFileContent}
              onChange={handleEditorChange}
            />
          ) : viewMode === "split" ? (
            <div className="split-panes">
              <EditorPane
                content={activeFileContent}
                onChange={handleEditorChange}
              />
              <PreviewPane content={activeFileContent} />
            </div>
          ) : (
            <PreviewPane content={activeFileContent} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
