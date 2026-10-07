import { writeFile } from "@tauri-apps/plugin-fs";

export async function saveImageFile(buffer: Uint8Array, vaultPath: string, fileName: string): Promise<string> {
  const timestamp = Date.now();
  const cleanName = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9-]/gi, "-");
  const imagePath = `${vaultPath}/.images/${cleanName}-${timestamp}.png`;

  try {
    await writeFile(imagePath, buffer);
    return imagePath;
  } catch (e) {
    throw new Error(`Failed to save image: ${e}`);
  }
}

export async function handleImagePaste(e: ClipboardEvent, vaultPath: string): Promise<string | null> {
  const items = e.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf("image") !== -1) {
      const file = item.getAsFile();
      if (file) {
        const buffer = await file.arrayBuffer();
        const imagePath = await saveImageFile(new Uint8Array(buffer), vaultPath, file.name);
        return imagePath;
      }
    }
  }
  return null;
}

export function getRelativeImagePath(imagePath: string, currentFilePath: string): string {
  const imageDir = imagePath.substring(0, imagePath.lastIndexOf("/"));
  const fileDir = currentFilePath.substring(0, currentFilePath.lastIndexOf("/"));

  if (imageDir === fileDir) {
    return imagePath.substring(imagePath.lastIndexOf("/") + 1);
  }

  const imageName = imagePath.substring(imagePath.lastIndexOf("/") + 1);
  return `../.images/${imageName}`;
}
