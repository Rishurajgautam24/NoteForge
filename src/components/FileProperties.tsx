import { useMemo } from "react";
import { calculateWordCount, calculateReadingTime } from "../lib/recentFiles";

interface FilePropertiesProps {
  content: string;
  fileName: string;
  filePath: string;
}

export default function FileProperties({
  content,
  fileName,
  filePath,
}: FilePropertiesProps) {
  const stats = useMemo(() => {
    const wordCount = calculateWordCount(content);
    const charCount = content.length;
    const lineCount = content.split("\n").length;
    const readingTime = calculateReadingTime(wordCount);
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0)
      .length;

    return {
      wordCount,
      charCount,
      lineCount,
      readingTime,
      paragraphs,
    };
  }, [content]);

  return (
    <div className="file-properties">
      <div className="file-properties-header">
        <span className="properties-label">File Info</span>
      </div>
      <div className="file-properties-grid">
        <div className="property-item">
          <span className="prop-label">File</span>
          <span className="prop-value" title={filePath}>
            {fileName}
          </span>
        </div>
        <div className="property-item">
          <span className="prop-label">Words</span>
          <span className="prop-value">{stats.wordCount.toLocaleString()}</span>
        </div>
        <div className="property-item">
          <span className="prop-label">Characters</span>
          <span className="prop-value">{stats.charCount.toLocaleString()}</span>
        </div>
        <div className="property-item">
          <span className="prop-label">Lines</span>
          <span className="prop-value">{stats.lineCount}</span>
        </div>
        <div className="property-item">
          <span className="prop-label">Paragraphs</span>
          <span className="prop-value">{stats.paragraphs}</span>
        </div>
        <div className="property-item">
          <span className="prop-label">Reading Time</span>
          <span className="prop-value">{stats.readingTime}</span>
        </div>
      </div>
    </div>
  );
}
