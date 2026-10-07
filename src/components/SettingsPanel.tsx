import { useEffect, useState } from "react";
import { toggleTheme, getStoredTheme, type Theme } from "../lib/themeManager";

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(true);

  const handleThemeToggle = () => {
    const newTheme = toggleTheme();
    setTheme(newTheme);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-section">
            <h3>Appearance</h3>
            <div className="setting-item">
              <div className="setting-label-group">
                <label className="setting-label">Theme</label>
                <span className="setting-hint">Dark / Light mode</span>
              </div>
              <button
                className="setting-button"
                onClick={handleThemeToggle}
              >
                {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>Editor</h3>
            <div className="setting-item">
              <div className="setting-label-group">
                <label className="setting-label">Auto-save</label>
                <span className="setting-hint">Save changes automatically</span>
              </div>
              <input
                type="checkbox"
                className="setting-checkbox"
                checked={autoSaveEnabled}
                onChange={(e) => setAutoSaveEnabled(e.target.checked)}
              />
            </div>
            <div className="setting-item">
              <div className="setting-label-group">
                <label className="setting-label">Spell Check</label>
                <span className="setting-hint">Check spelling as you type</span>
              </div>
              <input
                type="checkbox"
                className="setting-checkbox"
                checked={spellCheckEnabled}
                onChange={(e) => setSpellCheckEnabled(e.target.checked)}
              />
            </div>
          </div>

          <div className="settings-section">
            <h3>About</h3>
            <div className="setting-info">
              <div className="info-item">
                <span className="info-label">Version</span>
                <span className="info-value">1.0.0</span>
              </div>
              <div className="info-item">
                <span className="info-label">Build</span>
                <span className="info-value">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
