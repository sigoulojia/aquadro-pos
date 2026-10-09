use sqlx::{SqliteConnection, FromRow};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProductRepoModel {
    pub id: String,
    pub name_fr: String,
    pub sku: String,
    pub current_stock: f64,
}

pub struct ProductRepository;

impl ProductRepository {
    pub async fn insert(
        conn: &mut SqliteConnection, 
        id: &str, 
        name_fr: &str, 
        sku: &str
    ) -> Result<(), sqlx::Error> {
        let now = chrono::Utc::now().to_rfc3339();
        
        sqlx::query(
            r#"
            INSERT INTO products (
                id, category_id, sku, barcode, name_fr, name_ar,
                purchase_cost, selling_price_ttc, current_stock, min_stock_alert, is_active,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(id).bind(None::<String>).bind(sku).bind("12345678").bind(name_fr).bind(name_fr)
        .bind(0).bind(0).bind(0.0).bind(0.0).bind(1)
        .bind(&now).bind(&now)
        .execute(conn)
        .await?;

        Ok(())
    }

    pub async fn find_by_id(
        conn: &mut SqliteConnection, 
        id: &str
    ) -> Result<Option<ProductRepoModel>, sqlx::Error> {
        let product = sqlx::query_as::<_, ProductRepoModel>(
            r#"
            SELECT id, name_fr, sku, current_stock
            FROM products 
            WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(conn)
        .await?;

        Ok(product)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions, SqliteJournalMode};
    use std::str::FromStr;
    use crate::repo::tx::AquadroTx;

    async fn setup_test_pool() -> sqlx::SqlitePool {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join(format!("test_product_repo_{}.db", uuid::Uuid::new_v4()));
        let db_url = format!("sqlite:{}", db_path.display().to_string().replace("\\", "/"));

        let options = SqliteConnectOptions::from_str(&db_url).unwrap()
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal);

        let pool = SqlitePoolOptions::new().max_connections(5).connect_with(options).await.unwrap();
        
        let schema = include_str!("../../../src/db/schema.sql");
        sqlx::query(schema).execute(&pool).await.unwrap();
            
        pool
    }

    #[tokio::test]
    async fn test_product_repo_insert_and_find() {
        let pool = setup_test_pool().await;
        let mut tx = AquadroTx::begin_immediate(&pool).await.unwrap();
        
        ProductRepository::insert(tx.conn(), "prod-1", "Test Product", "SKU-TEST").await.unwrap();
        
        let found = ProductRepository::find_by_id(tx.conn(), "prod-1").await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().name_fr, "Test Product");
        
        tx.commit().await.unwrap();
    }
}
