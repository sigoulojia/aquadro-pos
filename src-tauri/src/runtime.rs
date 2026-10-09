use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqliteConnectOptions, Row, SqliteConnection, Connection, SqlitePool};
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuntimePathsInfo {
    pub app_data_dir: String,
    pub database_path: String,
    pub logs_dir: String,
    pub backups_dir: String,
    pub config_dir: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupInfo {
    pub filename: String,
    pub filepath: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub is_valid: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IntegrityReport {
    pub is_healthy: bool,
    pub checks: Vec<String>,
}

/// Resolves the application runtime directory structure
pub fn resolve_runtime_paths(app_handle: &AppHandle) -> Result<(PathBuf, PathBuf, PathBuf, PathBuf, PathBuf), String> {
    let app_data = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to resolve AppData directory: {}", e))?;
    
    let db_path = app_data.join("aquadro_v2.db");
    let logs_dir = app_data.join("logs");
    let backups_dir = app_data.join("backups");
    let config_dir = app_data.join("config");

    Ok((app_data, db_path, logs_dir, backups_dir, config_dir))
}

/// Creates all required runtime directories on application startup
pub fn ensure_runtime_directories(app_handle: &AppHandle) -> Result<RuntimePathsInfo, String> {
    let (app_data, db_path, logs_dir, backups_dir, config_dir) = resolve_runtime_paths(app_handle)?;

    fs::create_dir_all(&app_data).map_err(|e| format!("Failed to create AppData directory: {}", e))?;
    fs::create_dir_all(&logs_dir).map_err(|e| format!("Failed to create logs directory: {}", e))?;
    fs::create_dir_all(&backups_dir).map_err(|e| format!("Failed to create backups directory: {}", e))?;
    fs::create_dir_all(&config_dir).map_err(|e| format!("Failed to create config directory: {}", e))?;

    Ok(RuntimePathsInfo {
        app_data_dir: app_data.display().to_string(),
        database_path: db_path.display().to_string(),
        logs_dir: logs_dir.display().to_string(),
        backups_dir: backups_dir.display().to_string(),
        config_dir: config_dir.display().to_string(),
    })
}

/// Verifies database integrity via PRAGMA integrity_check
pub async fn check_pool_integrity(pool: &SqlitePool) -> Result<IntegrityReport, String> {
    let rows = sqlx::query("PRAGMA integrity_check(10);")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to run integrity check: {}", e))?;

    let mut checks = Vec::new();
    let mut is_healthy = true;

    for row in rows {
        let result: String = row.try_get(0).unwrap_or_else(|_| "unknown".to_string());
        if result != "ok" {
            is_healthy = false;
        }
        checks.push(result);
    }

    Ok(IntegrityReport {
        is_healthy,
        checks,
    })
}

/// Checks the integrity of a standalone SQLite database file on disk
pub async fn check_file_integrity(db_file: &Path) -> Result<bool, String> {
    if !db_file.exists() {
        return Ok(false);
    }
    let db_url = format!("sqlite:{}?mode=ro", db_file.display().to_string().replace('\\', "/"));
    let options = SqliteConnectOptions::from_str(&db_url).map_err(|e| e.to_string())?;
    let mut conn = SqliteConnection::connect_with(&options).await.map_err(|e| e.to_string())?;

    let row = sqlx::query("PRAGMA quick_check(1);")
        .fetch_one(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    let result: String = row.try_get(0).unwrap_or_default();
    Ok(result == "ok")
}

/// Tauri Command: Get active runtime directories information
#[tauri::command]
pub fn get_runtime_paths(app_handle: tauri::AppHandle) -> Result<RuntimePathsInfo, String> {
    ensure_runtime_directories(&app_handle)
}

/// Tauri Command: Create an atomic database backup into backups/
#[tauri::command]
pub async fn create_database_backup(
    label: Option<String>,
    pool: tauri::State<'_, SqlitePool>,
    app_handle: tauri::AppHandle,
) -> Result<BackupInfo, String> {
    let (_, _, _, backups_dir, _) = resolve_runtime_paths(&app_handle)?;
    fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;

    let now = Local::now();
    let timestamp = now.format("%Y%m%d_%H%M%S").to_string();
    let clean_label = label
        .map(|l| {
            l.chars()
                .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                .collect::<String>()
        })
        .unwrap_or_else(|| "manual".to_string());

    let filename = format!("backup_aquadro_{}_{}.db", timestamp, clean_label);
    let target_path = backups_dir.join(&filename);
    let target_str = target_path.display().to_string().replace('\\', "/");

    crate::logger::log_info("BACKUP", &format!("Starting atomic backup to: {}", target_str));

    // Execute SQLite VACUUM INTO for consistent online snapshot
    let query_str = format!("VACUUM INTO '{}';", target_str);
    sqlx::query(&query_str)
        .execute(&*pool)
        .await
        .map_err(|e| {
            crate::logger::log_error("BACKUP", &format!("VACUUM INTO failed: {}", e));
            format!("Backup creation failed: {}", e)
        })?;

    // Verify integrity of the backup
    let is_valid = check_file_integrity(&target_path).await.unwrap_or(false);
    let size_bytes = fs::metadata(&target_path).map(|m| m.len()).unwrap_or(0);

    crate::logger::log_info(
        "BACKUP",
        &format!("Backup created: {} ({} bytes, valid: {})", filename, size_bytes, is_valid),
    );

    Ok(BackupInfo {
        filename,
        filepath: target_str,
        size_bytes,
        created_at: now.to_rfc3339(),
        is_valid,
    })
}

/// Tauri Command: List all available backups
#[tauri::command]
pub async fn list_database_backups(app_handle: tauri::AppHandle) -> Result<Vec<BackupInfo>, String> {
    let (_, _, _, backups_dir, _) = resolve_runtime_paths(&app_handle)?;
    if !backups_dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();
    let entries = fs::read_dir(&backups_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("db") {
            let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            let size_bytes = metadata.len();
            let created_at = metadata
                .created()
                .or_else(|_| metadata.modified())
                .map(|t| chrono::DateTime::<Local>::from(t).to_rfc3339())
                .unwrap_or_else(|_| "".to_string());

            // Quick check
            let is_valid = check_file_integrity(&path).await.unwrap_or(false);

            backups.push(BackupInfo {
                filename,
                filepath: path.display().to_string().replace('\\', "/"),
                size_bytes,
                created_at,
                is_valid,
            });
        }
    }

    // Sort newest first
    backups.sort_by(|a, b| b.filename.cmp(&a.filename));
    Ok(backups)
}

/// Tauri Command: Verify active database health
#[tauri::command]
pub async fn verify_database_integrity(pool: tauri::State<'_, SqlitePool>) -> Result<IntegrityReport, String> {
    check_pool_integrity(&pool).await
}
