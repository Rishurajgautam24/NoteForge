import { useCallback, useEffect, useRef, useState } from "react";
import type { FileEntry } from "../types";

interface SidebarProps {
  files: FileEntry[];
  vaultPath: string | null;
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  onNewFile: (dir?: string) => void;
  onNewFolder: (dir?: string) => void;
  onOpenVault: () => void;
  onRefresh: () => void;
  onRename: (entry: FileEntry) => void;
  onDelete: (entry: FileEntry) => void;
  autoExpand?: string | null;
}

interface ContextMenuState {
  entry: FileEntry;
  x: number;
  y: number;
}

function FileTreeNode({
  entry,
  depth,
  activeFilePath,
  onFileSelect,
  onContextMenu,
  expandedSet,
  onToggle,
}: {
  entry: FileEntry;
  depth: number;
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  onContextMenu: (entry: FileEntry, x: number, y: number) => void;
  expandedSet: Set<string>;
  onToggle: (path: string) => void;
}) {
  const expanded = expandedSet.has(entry.path);
  const isActive = activeFilePath === entry.path;
  const isMdFile =
    !entry.is_directory && entry.name.endsWith(".md");

  if (!entry.is_directory && !isMdFile && !entry.name.endsWith(".txt")) {
    return null;
  }

  const handleClick = () => {
    if (entry.is_directory) {
      onToggle(entry.path);
    } else {
      onFileSelect(entry.path);
    }
  };

  return (
    <div>
      <div
        className={`sidebar-item ${isActive ? "active" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(entry, e.clientX, e.clientY);
        }}
      >
        <span className="sidebar-icon">
          {entry.is_directory ? (expanded ? "▼" : "▶") : "📄"}
        </span>
        <span className="sidebar-name">{entry.name}</span>
      </div>
      {entry.is_directory && expanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              activeFilePath={activeFilePath}
              onFileSelect={onFileSelect}
              onContextMenu={onContextMenu}
              expandedSet={expandedSet}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  files,
  vaultPath,
  activeFilePath,
  onFileSelect,
  onNewFile,
  onNewFolder,
  onOpenVault,
  onRefresh,
  onRename,
  onDelete,
  autoExpand,
}: SidebarProps) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  // Track which folders are expanded so a refresh (or an external change picked
  // up by the watcher) doesn't collapse the tree and hide newly created files.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Expand top-level folders by default on first load.
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    const next = new Set<string>();
    for (const e of files) {
      if (e.is_directory) {
        next.add(e.path);
      }
    }
    setExpanded(next);
  }, [files]);

  // When a file/folder is created inside a directory, make sure that directory
  // is expanded so the new entry is actually visible.
  useEffect(() => {
    if (!autoExpand) return;
    setExpanded((prev) => {
      if (prev.has(autoExpand)) return prev;
      const next = new Set(prev);
      next.add(autoExpand);
      return next;
    });
  }, [autoExpand]);

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Dismiss the context menu on any outside click, Escape, or window blur.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">
          {vaultPath ? vaultPath.split("/").pop() || "Vault" : "No vault open"}
        </span>
      </div>
      <div className="sidebar-actions">
        <button className="sidebar-btn" onClick={onOpenVault} title="Open vault">
          📂
        </button>
        <button
          className="sidebar-btn"
          onClick={() => onNewFile()}
          disabled={!vaultPath}
          title="New file"
        >
          +
        </button>
        <button
          className="sidebar-btn"
          onClick={() => onNewFolder()}
          disabled={!vaultPath}
          title="New folder"
        >
          📁
        </button>
        <button
          className="sidebar-btn"
          onClick={onRefresh}
          disabled={!vaultPath}
          title="Refresh vault"
        >
          ⟳
        </button>
      </div>
      <div className="sidebar-tree">
        {files.length === 0 && vaultPath && (
          <div className="sidebar-empty">Empty vault</div>
        )}
        {!vaultPath && (
          <div className="sidebar-empty">Open a vault to get started</div>
        )}
        {files.map((entry) => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            activeFilePath={activeFilePath}
            onFileSelect={onFileSelect}
            onContextMenu={(entry, x, y) => setMenu({ entry, x, y })}
            expandedSet={expanded}
            onToggle={toggle}
          />
        ))}
      </div>
      {menu && (
        <div
          className="ctx-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {menu.entry.is_directory && (
            <>
              <button
                className="ctx-item"
                onClick={() => {
                  onNewFile(menu.entry.path);
                  setMenu(null);
                }}
              >
                New file here
              </button>
              <button
                className="ctx-item"
                onClick={() => {
                  onNewFolder(menu.entry.path);
                  setMenu(null);
                }}
              >
                New folder here
              </button>
            </>
          )}
          <button
            className="ctx-item"
            onClick={() => {
              onRename(menu.entry);
              setMenu(null);
            }}
          >
            Rename
          </button>
          <button
            className="ctx-item danger"
            onClick={() => {
              onDelete(menu.entry);
              setMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
