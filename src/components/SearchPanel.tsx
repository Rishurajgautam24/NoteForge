import { useCallback, useEffect, useRef, useState } from "react";
import { readFile } from "../lib/ipc";
import type { FileEntry } from "../types";

interface SearchResult {
  filePath: string;
  fileName: string;
  matches: number;
  preview: string;
}

interface SearchPanelProps {
  files: FileEntry[];
  onSelectFile: (path: string) => void;
  onClose: () => void;
}

const getAllFiles = (entries: FileEntry[]): FileEntry[] => {
  const all: FileEntry[] = [];
  for (const entry of entries) {
    if (!entry.is_directory && (entry.name.endsWith(".md") || entry.name.endsWith(".txt"))) {
      all.push(entry);
    }
    if (entry.is_directory) {
      all.push(...getAllFiles(entry.children));
    }
  }
  return all;
};

export default function SearchPanel({
  files,
  onSelectFile,
  onClose,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    const allFiles = getAllFiles(files);
    const searchResults: SearchResult[] = [];
    const lowerQuery = searchQuery.toLowerCase();

    for (const file of allFiles) {
      try {
        const content = await readFile(file.path);
        const lowerContent = content.toLowerCase();
        const matches = (content.match(new RegExp(lowerQuery, "gi")) || []).length;

        if (matches > 0) {
          const idx = lowerContent.indexOf(lowerQuery);
          const start = Math.max(0, idx - 40);
          const end = Math.min(content.length, idx + 100);
          const preview = content.slice(start, end);

          searchResults.push({
            filePath: file.path,
            fileName: file.name,
            matches,
            preview: `...${preview}...`.replace(/\n/g, " "),
          });
        }
      } catch {}
    }

    setResults(searchResults.sort((a, b) => b.matches - a.matches));
    setSearching(false);
  }, [files]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  return (
    <div className="search-panel">
      <div className="search-header">
        <input
          ref={searchRef}
          type="text"
          className="search-input"
          placeholder="Search notes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && results.length > 0) {
              onSelectFile(results[0].filePath);
              onClose();
            }
          }}
        />
        <button className="search-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="search-body">
        {searching ? (
          <div className="search-status">Searching...</div>
        ) : query.trim() ? (
          <>
            <div className="search-count">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </div>
            {results.length === 0 ? (
              <div className="search-empty">No results found</div>
            ) : (
              <div className="search-results">
                {results.map((result) => (
                  <div
                    key={result.filePath}
                    className="search-result-item"
                    onClick={() => {
                      onSelectFile(result.filePath);
                      onClose();
                    }}
                  >
                    <div className="result-header">
                      <span className="result-name">{result.fileName}</span>
                      <span className="result-count">{result.matches} match{result.matches !== 1 ? "es" : ""}</span>
                    </div>
                    <div className="result-preview">{result.preview}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="search-empty">Start typing to search...</div>
        )}
      </div>
    </div>
  );
}
