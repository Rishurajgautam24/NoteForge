use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub children: Vec<FileEntry>,
    pub last_modified: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultContents {
    pub root_path: String,
    pub files: Vec<FileEntry>,
}

fn build_tree(base: &std::path::Path) -> Vec<FileEntry> {
    if !base.exists() {
        return Vec::new();
    }

    let mut dirs: Vec<FileEntry> = Vec::new();
    let mut file_entries: Vec<FileEntry> = Vec::new();

    for entry in WalkDir::new(base).max_depth(1).sort_by(|a, b| {
        let a_name = a.file_name().to_string_lossy().to_lowercase();
        let b_name = b.file_name().to_string_lossy().to_lowercase();
        a_name.cmp(&b_name)
    }) {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        if entry.path() == base {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let modified = match metadata.modified() {
            Ok(t) => {
                let dt: chrono::DateTime<Utc> = t.into();
                dt.format("%Y-%m-%dT%H:%M:%SZ").to_string()
            }
            Err(_) => Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        };

        let fe = FileEntry {
            path: entry.path().to_string_lossy().to_string(),
            name: entry.file_name().to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            children: Vec::new(),
            last_modified: modified,
        };

        if metadata.is_dir() {
            let mut dir_entry = fe;
            dir_entry.children = build_tree(entry.path());
            dirs.push(dir_entry);
        } else {
            file_entries.push(fe);
        }
    }

    dirs.extend(file_entries);
    dirs
}

#[tauri::command]
pub fn list_vault(path: String) -> Result<VaultContents, String> {
    let base = PathBuf::from(&path);
    if !base.exists() {
        return Err("Vault path does not exist".to_string());
    }
    let files = build_tree(&base);
    Ok(VaultContents {
        root_path: path,
        files,
    })
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    fs::write(&path, "").map_err(|e| format!("Failed to create file: {}", e))
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create directory: {}", e))
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| format!("Failed to delete directory: {}", e))
    } else {
        fs::remove_file(&p).map_err(|e| format!("Failed to delete file: {}", e))
    }
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| format!("Failed to rename: {}", e))
}

#[tauri::command]
pub fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(&path, &data).map_err(|e| format!("Failed to write binary file: {}", e))
}

#[tauri::command]
pub async fn open_vault_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file = app
        .dialog()
        .file()
        .blocking_pick_folder();
    Ok(file.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn save_file_dialog(
    app: tauri::AppHandle,
    default_name: String,
    filter_name: String,
    filter_ext: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file = app
        .dialog()
        .file()
        .add_filter(filter_name, &[filter_ext.as_str()])
        .set_file_name(&default_name)
        .blocking_save_file();
    Ok(file.map(|p| p.to_string()))
}
