interface ShortcutCategory {
  title: string;
  shortcuts: Array<{ key: string; description: string }>;
}

const SHORTCUTS: ShortcutCategory[] = [
  {
    title: "General",
    shortcuts: [
      { key: "Cmd+Shift+F", description: "Search vault" },
      { key: "Cmd+K", description: "Command palette (future)" },
      { key: "Cmd+,", description: "Open settings" },
    ],
  },
  {
    title: "File Management",
    shortcuts: [
      { key: "Cmd+N", description: "New file" },
      { key: "Cmd+Shift+N", description: "New folder" },
      { key: "Cmd+Delete", description: "Delete file" },
      { key: "Cmd+R", description: "Rename file" },
    ],
  },
  {
    title: "Editor",
    shortcuts: [
      { key: "Cmd+B", description: "Bold" },
      { key: "Cmd+I", description: "Italic" },
      { key: "Cmd+U", description: "Underline" },
      { key: "Cmd+/", description: "Toggle comment" },
      { key: "Cmd+Z", description: "Undo" },
      { key: "Cmd+Shift+Z", description: "Redo" },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { key: "Cmd+1", description: "Edit mode" },
      { key: "Cmd+2", description: "Split view" },
      { key: "Cmd+3", description: "Preview mode" },
      { key: "Cmd+L", description: "Toggle light/dark mode" },
    ],
  },
];

interface KeyboardShortcutsProps {
  onClose: () => void;
}

export default function KeyboardShortcuts({ onClose }: KeyboardShortcutsProps) {
  return (
    <div className="shortcuts-modal-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="shortcuts-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="shortcuts-body">
          {SHORTCUTS.map((category) => (
            <div key={category.title} className="shortcut-category">
              <h3>{category.title}</h3>
              <div className="shortcut-list">
                {category.shortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="shortcut-item">
                    <kbd className="shortcut-key">{shortcut.key}</kbd>
                    <span className="shortcut-desc">{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
