import { useEffect, useRef, useState } from "react";

interface FindReplacePanelProps {
  onFind: (query: string) => void;
  onReplace: (query: string, replacement: string) => void;
  onClose: () => void;
  matchCount?: number;
}

export default function FindReplacePanel({
  onFind,
  onReplace,
  onClose,
  matchCount = 0,
}: FindReplacePanelProps) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const findRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    findRef.current?.focus();
  }, []);

  const handleFind = () => {
    onFind(find);
  };

  const handleReplace = () => {
    onReplace(find, replace);
  };

  return (
    <div className="find-replace-panel">
      <div className="fr-row">
        <input
          ref={findRef}
          type="text"
          className="fr-input"
          placeholder="Find..."
          value={find}
          onChange={(e) => {
            setFind(e.target.value);
            onFind(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter") handleFind();
          }}
        />
        <span className="fr-count">{find && matchCount > 0 ? `${matchCount} match${matchCount !== 1 ? "es" : ""}` : ""}</span>
        <button className="fr-toggle" onClick={() => setShowReplace(!showReplace)} title="Toggle replace">
          {showReplace ? "▼" : "▶"}
        </button>
        <button className="fr-close" onClick={onClose}>
          ✕
        </button>
      </div>

      {showReplace && (
        <div className="fr-row">
          <input
            type="text"
            className="fr-input"
            placeholder="Replace..."
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter") handleReplace();
            }}
          />
          <button className="fr-btn" onClick={handleReplace} disabled={!find}>
            Replace All
          </button>
        </div>
      )}
    </div>
  );
}
