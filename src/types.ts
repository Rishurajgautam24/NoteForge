export interface FileEntry {
  path: string;
  name: string;
  is_directory: boolean;
  children: FileEntry[];
  last_modified: string;
}

export interface VaultContents {
  root_path: string;
  files: FileEntry[];
}

export type ViewMode = "edit" | "preview" | "split";
