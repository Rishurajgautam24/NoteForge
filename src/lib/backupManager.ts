import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { createDirectory } from "../lib/ipc";

export interface BackupInfo {
  timestamp: number;
  date: string;
  size: number;
  fileName: string;
}

const BACKUP_DIR = ".backups";
const BACKUP_INTERVAL = 3600000; // 1 hour in milliseconds

export async function createBackup(filePath: string, content: string): Promise<void> {
  try {
    const vaultPath = filePath.substring(0, filePath.lastIndexOf("/"));
    const backupDir = `${vaultPath}/${BACKUP_DIR}`;
    const timestamp = Date.now();
    const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);
    const backupFileName = `${fileName}.${timestamp}.backup`;
    const backupPath = `${backupDir}/${backupFileName}`;

    // Create backup directory if it doesn't exist
    try {
      await createDirectory(backupDir);
    } catch {}

    // Write backup file as UTF-8
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    await writeFile(backupPath, data);
  } catch (e) {
    console.error("Backup failed:", e);
  }
}

export async function getBackupInfo(_filePath: string): Promise<BackupInfo[]> {
  // In a real implementation, we would list files from the backup directory
  // For now, return empty array as this requires directory listing capability
  return [];
}

export async function restoreBackup(filePath: string, backupPath: string): Promise<void> {
  try {
    const content = await readFile(backupPath);
    await writeFile(filePath, content);
  } catch (e) {
    throw new Error(`Failed to restore backup: ${e}`);
  }
}

export function shouldCreateBackup(lastBackupTime: number): boolean {
  return Date.now() - lastBackupTime > BACKUP_INTERVAL;
}
