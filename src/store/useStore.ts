import { create } from "zustand";
import type { FileEntry, ViewMode } from "../types";

interface AppState {
  vaultPath: string | null;
  fileTree: FileEntry[];
  activeFilePath: string | null;
  activeFileContent: string;
  isDirty: boolean;
  viewMode: ViewMode;

  setVaultPath: (path: string | null) => void;
  setFileTree: (tree: FileEntry[]) => void;
  setActiveFile: (path: string | null, content: string) => void;
  setActiveFileContent: (content: string) => void;
  setDirty: (dirty: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useStore = create<AppState>((set) => ({
  vaultPath: null,
  fileTree: [],
  activeFilePath: null,
  activeFileContent: "",
  isDirty: false,
  viewMode: "split",

  setVaultPath: (path) => set({ vaultPath: path }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setActiveFile: (path, content) =>
    set({ activeFilePath: path, activeFileContent: content, isDirty: false }),
  setActiveFileContent: (content) =>
    set({ activeFileContent: content, isDirty: true }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
