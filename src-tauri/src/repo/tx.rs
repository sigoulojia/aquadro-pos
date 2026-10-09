use sqlx::{sqlite::SqlitePool, pool::PoolConnection, Sqlite, SqliteConnection};
use std::time::Duration;

pub struct AquadroTx {
    conn: Option<PoolConnection<Sqlite>>,
    committed: bool,
}

impl AquadroTx {
    pub async fn begin(pool: &SqlitePool) -> Result<Self, sqlx::Error> {
        let mut conn = pool.acquire().await?;
        sqlx::query("BEGIN DEFERRED").execute(&mut *conn).await?;
        Ok(Self { conn: Some(conn), committed: false })
    }

    pub async fn begin_immediate(pool: &SqlitePool) -> Result<Self, sqlx::Error> {
        let mut conn = pool.acquire().await?;
        sqlx::query("BEGIN IMMEDIATE").execute(&mut *conn).await?;
        Ok(Self { conn: Some(conn), committed: false })
    }

    pub async fn begin_immediate_with_retry(pool: &SqlitePool, max_retries: u32) -> Result<Self, sqlx::Error> {
        let mut retries = 0;
        loop {
            let mut conn = pool.acquire().await?;
            match sqlx::query("BEGIN IMMEDIATE").execute(&mut *conn).await {
                Ok(_) => return Ok(Self { conn: Some(conn), committed: false }),
                Err(e) => {
                    let err_str = e.to_string().to_lowercase();
                    if err_str.contains("database is locked") || err_str.contains("busy") {
                        if retries < max_retries {
                            retries += 1;
                            tokio::time::sleep(Duration::from_millis(200)).await;
                            continue;
                        }
                    }
                    return Err(e);
                }
            }
        }
    }

    pub async fn commit(mut self) -> Result<(), sqlx::Error> {
        sqlx::query("COMMIT").execute(self.conn()).await?;
        self.committed = true;
        Ok(())
    }

    pub async fn rollback(mut self) -> Result<(), sqlx::Error> {
        sqlx::query("ROLLBACK").execute(self.conn()).await?;
        self.committed = true;
        Ok(())
    }

    pub fn conn(&mut self) -> &mut SqliteConnection {
        &mut *self.conn.as_mut().unwrap()
    }
}

impl Drop for AquadroTx {
    fn drop(&mut self) {
        if !self.committed {
            if let Some(mut conn) = self.conn.take() {
                tokio::spawn(async move {
                    let _ = sqlx::query("ROLLBACK").execute(&mut *conn).await;
                });
            }
            // Uncommitted transactions are automatically rolled back when connection is returned to pool.
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions, SqliteJournalMode};
    use std::str::FromStr;

    async fn setup_test_pool() -> SqlitePool {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join(format!("test_repo_tx_{}.db", uuid::Uuid::new_v4()));
        let db_url = format!("sqlite:{}", db_path.display().to_string().replace("\\", "/"));

        let options = SqliteConnectOptions::from_str(&db_url).unwrap()
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .busy_timeout(std::time::Duration::from_millis(5000));

        let pool = SqlitePoolOptions::new().max_connections(5).connect_with(options).await.unwrap();
        
        sqlx::query("CREATE TABLE IF NOT EXISTS tx_test (id INTEGER PRIMARY KEY, val TEXT);")
            .execute(&pool).await.unwrap();
            
        pool
    }

    #[tokio::test]
    async fn test_tx_begin_commit() {
        let pool = setup_test_pool().await;
        
        let mut tx = AquadroTx::begin_immediate(&pool).await.unwrap();
        sqlx::query("INSERT INTO tx_test (val) VALUES (\"test1\")").execute(tx.conn()).await.unwrap();
        tx.commit().await.unwrap();

        let row: (String,) = sqlx::query_as("SELECT val FROM tx_test").fetch_one(&pool).await.unwrap();
        assert_eq!(row.0, "test1");
    }

    #[tokio::test]
    async fn test_tx_rollback() {
        let pool = setup_test_pool().await;
        
        let mut tx = AquadroTx::begin_immediate(&pool).await.unwrap();
        sqlx::query("INSERT INTO tx_test (val) VALUES (\"test2\")").execute(tx.conn()).await.unwrap();
        tx.rollback().await.unwrap();

        let row: Result<(String,), _> = sqlx::query_as("SELECT val FROM tx_test").fetch_one(&pool).await;
        assert!(row.is_err(), "Row should not exist after rollback");
    }

    #[tokio::test]
    async fn test_tx_concurrent_immediate_blocks() {
        let pool = setup_test_pool().await;
        
        let tx1 = AquadroTx::begin_immediate(&pool).await.unwrap();
        
        let pool_clone = pool.clone();
        
        let handle = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(200)).await;
            tx1.commit().await.unwrap();
        });

        let tx2 = AquadroTx::begin_immediate(&pool_clone).await.unwrap();
        
        handle.await.unwrap();
        tx2.commit().await.unwrap();
    }

    #[tokio::test]
    async fn test_tx_begin_immediate_with_retry() {
        // Fast timeout pool to force SQLITE_BUSY quickly and trigger app-level retry loop
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join(format!("test_repo_tx_retry_{}.db", uuid::Uuid::new_v4()));
        let db_url = format!("sqlite:{}", db_path.display().to_string().replace("\\", "/"));

        let options = SqliteConnectOptions::from_str(&db_url).unwrap()
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .busy_timeout(std::time::Duration::from_millis(1)); // 1ms timeout

        let pool = SqlitePoolOptions::new().max_connections(5).connect_with(options).await.unwrap();
        sqlx::query("CREATE TABLE IF NOT EXISTS tx_test (id INTEGER PRIMARY KEY, val TEXT);")
            .execute(&pool).await.unwrap();

        let tx1 = AquadroTx::begin_immediate(&pool).await.unwrap();
        let pool_clone = pool.clone();
        
        let handle = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(100)).await;
            drop(tx1);
        });

        // This will fail instantly inside SQLite due to 1ms timeout, 
        // triggering our app-level retry which sleeps for 200ms.
        // During that sleep, tx1 is dropped. The next retry succeeds!
        let tx2 = AquadroTx::begin_immediate_with_retry(&pool_clone, 3).await.unwrap();
        tx2.commit().await.unwrap();
        handle.await.unwrap();
    }
}
