import { invoke } from "@tauri-apps/api/core";
import type { VaultContents } from "../types";

export async function listVault(path: string): Promise<VaultContents> {
  return invoke("list_vault", { path });
}

export async function readFile(path: string): Promise<string> {
  return invoke("read_file", { path });
}

export async function writeFile(path: string, content: string): Promise<void> {
  return invoke("write_file", { path, content });
}

export async function createFile(path: string): Promise<void> {
  return invoke("create_file", { path });
}

export async function createDirectory(path: string): Promise<void> {
  return invoke("create_directory", { path });
}

export async function deleteFile(path: string): Promise<void> {
  return invoke("delete_file", { path });
}

export async function renameFile(
  oldPath: string,
  newPath: string
): Promise<void> {
  return invoke("rename_file", { oldPath, newPath });
}

export async function openVaultDialog(): Promise<string | null> {
  return invoke("open_vault_dialog");
}

export async function writeBinaryFile(path: string, data: number[]): Promise<void> {
  return invoke("write_binary_file", { path, data });
}

export async function saveFileDialog(
  defaultName: string,
  filterName: string,
  filterExt: string
): Promise<string | null> {
  return invoke("save_file_dialog", {
    defaultName,
    filterName,
    filterExt,
  });
}
