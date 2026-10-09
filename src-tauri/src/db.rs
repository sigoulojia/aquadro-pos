use sqlx::{sqlite::{SqliteConnectOptions, SqlitePoolOptions}, SqlitePool};
use std::str::FromStr;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use std::fs;

pub async fn init_db(app_handle: &AppHandle) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let app_dir = app_handle.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("aquadro_v2.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display().to_string().replace('\\', "/"));

    let options = SqliteConnectOptions::from_str(&db_url)?
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .busy_timeout(std::time::Duration::from_millis(5000));

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    // Load and execute the schema if necessary
    // We will bake it into the binary
    let schema = include_str!("../../src/db/schema.sql");
    sqlx::query(schema).execute(&pool).await?;
    // Run Gate 1C safe rebuild migrations
    crate::migrations::apply_gate_1c_migrations(&pool).await?;

    // Insert seeds if needed
    // TODO: move seed logic here or execute a seed.sql

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
