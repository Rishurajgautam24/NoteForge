export interface RecentFile {
  path: string;
  name: string;
  timestamp: number;
  wordCount: number;
}

const RECENT_FILES_KEY = "noteforge:recentFiles";
const MAX_RECENT = 10;

export function getRecentFiles(): RecentFile[] {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as RecentFile[];
  } catch {
    return [];
  }
}

export function saveRecentFile(file: RecentFile): void {
  try {
    let recent = getRecentFiles();
    // Remove if already exists
    recent = recent.filter((f) => f.path !== file.path);
    // Add to front
    recent.unshift(file);
    // Keep only recent MAX_RECENT
    recent = recent.slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recent));
  } catch {}
}

export function removeRecentFile(path: string): void {
  try {
    let recent = getRecentFiles();
    recent = recent.filter((f) => f.path !== path);
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recent));
  } catch {}
}

export function calculateWordCount(content: string): number {
  return content
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export function calculateReadingTime(wordCount: number): string {
  const wordsPerMinute = 200;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  if (minutes < 1) return "< 1 min";
  if (minutes === 1) return "1 min";
  return `${minutes} min`;
}
