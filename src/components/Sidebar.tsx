import { useState } from "react";
import type { FileEntry } from "../types";

interface SidebarProps {
  files: FileEntry[];
  vaultPath: string | null;
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onOpenVault: () => void;
}

function FileTreeNode({
  entry,
  depth,
  activeFilePath,
  onFileSelect,
}: {
  entry: FileEntry;
  depth: number;
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isActive = activeFilePath === entry.path;
  const isMdFile =
    !entry.is_directory && entry.name.endsWith(".md");

  if (!entry.is_directory && !isMdFile && !entry.name.endsWith(".txt")) {
    return null;
  }

  const handleClick = () => {
    if (entry.is_directory) {
      setExpanded(!expanded);
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
}: SidebarProps) {
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
          onClick={onNewFile}
          disabled={!vaultPath}
          title="New file"
        >
          +
        </button>
        <button
          className="sidebar-btn"
          onClick={onNewFolder}
          disabled={!vaultPath}
          title="New folder"
        >
          📁
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
          />
        ))}
      </div>
    </div>
  );
}
