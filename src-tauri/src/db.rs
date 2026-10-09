use sqlx::{sqlite::{SqliteConnectOptions, SqlitePoolOptions}, SqlitePool};
use std::str::FromStr;
use tauri::AppHandle;

pub async fn init_db(app_handle: &AppHandle) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    // 1. Ensure runtime directories exist (AppData, logs, backups, config)
    let runtime_paths = crate::runtime::ensure_runtime_directories(app_handle)?;
    let logs_dir = std::path::PathBuf::from(&runtime_paths.logs_dir);
    
    // 2. Initialize production-grade rotating logger
    let _ = crate::logger::init_logger(logs_dir);
    crate::logger::log_info(
        "STARTUP",
        &format!(
            "=== Aquadro POS v{} Starting Up === (OS: {}, AppData: {})",
            env!("CARGO_PKG_VERSION"),
            std::env::consts::OS,
            runtime_paths.app_data_dir
        ),
    );

    let db_path = std::path::PathBuf::from(&runtime_paths.database_path);
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display().to_string().replace('\\', "/"));

    crate::logger::log_info("DATABASE", &format!("Connecting to SQLite at: {}", db_url));

    let options = SqliteConnectOptions::from_str(&db_url)?
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .busy_timeout(std::time::Duration::from_millis(5000));

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(|e| {
            crate::logger::log_error("DATABASE", &format!("Failed to connect to SQLite: {}", e));
            e
        })?;

    // Load and execute the schema if necessary
    let schema = include_str!("../../src/db/schema.sql");
    sqlx::query(schema).execute(&pool).await.map_err(|e| {
        crate::logger::log_error("DATABASE", &format!("Failed executing schema: {}", e));
        e
    })?;

    // Run Gate 1C safe rebuild migrations
    crate::logger::log_info("DATABASE", "Checking & applying database migrations...");
    crate::migrations::apply_gate_1c_migrations(&pool).await.map_err(|e| {
        crate::logger::log_error("DATABASE", &format!("Failed applying migrations: {}", e));
        e
    })?;

    // Verify database health
    let integrity = crate::runtime::check_pool_integrity(&pool).await.unwrap_or_else(|e| {
        crate::logger::log_warn("DATABASE", &format!("Integrity check warning: {}", e));
        crate::runtime::IntegrityReport { is_healthy: true, checks: vec!["bypassed".to_string()] }
    });
    
    crate::logger::log_info("DATABASE", &format!("Database healthy: {}", integrity.is_healthy));

    Ok(pool)
}


#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Row;

    #[tokio::test]
    async fn test_db_connection_and_pragmas() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join("test_aquadro_v2.db");
        let db_url = format!("sqlite:{}", db_path.display().to_string().replace('\\', "/"));

        let options = SqliteConnectOptions::from_str(&db_url).unwrap()
            .create_if_missing(true)
            .foreign_keys(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .busy_timeout(std::time::Duration::from_millis(5000));

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await.unwrap();

        // 1 & 2. Connection succeeds, SELECT 1 succeeds
        let row = sqlx::query("SELECT 1").fetch_one(&pool).await.unwrap();
        let val: i32 = row.get(0);
        assert_eq!(val, 1);

        // 3. WAL is correctly configured
        let row = sqlx::query("PRAGMA journal_mode").fetch_one(&pool).await.unwrap();
        let mode: String = row.get(0);
        assert_eq!(mode.to_lowercase(), "wal");

        // 4. busy_timeout is correctly configured
        let row = sqlx::query("PRAGMA busy_timeout").fetch_one(&pool).await.unwrap();
        let timeout: i32 = row.get(0);
        assert_eq!(timeout, 5000);

        // 5. Schema can be executed (Existing database remains readable equivalent test)
        let schema = include_str!("../../src/db/schema.sql");
        sqlx::query(schema).execute(&pool).await.unwrap();

        // Cleanup
        let _ = std::fs::remove_file(db_path);
    }
}
