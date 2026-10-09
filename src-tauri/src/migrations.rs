use sqlx::SqlitePool;

pub async fn apply_gate_1c_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // Check if the constraint already exists
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='products' AND sql LIKE '%CHECK(current_stock >= 0.0)%';"
    ).fetch_optional(pool).await?;

    if row.is_some() {
        return Ok(()); // Already applied
    }

    // 12-step rebuild for 'products' and 'product_batches'
    let mut tx = pool.begin().await?;

    // Enable legacy alter table to avoid foreign key errors during drop
    sqlx::query("PRAGMA legacy_alter_table = ON;").execute(&mut *tx).await?;

    // PRODUCTS
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS new_products (
            id TEXT PRIMARY KEY,
            store_id TEXT REFERENCES stores(id),
            category_id TEXT REFERENCES categories(id),
            brand_id TEXT REFERENCES brands(id),
            sku TEXT UNIQUE NOT NULL,
            barcode TEXT UNIQUE NOT NULL,
            additional_barcodes TEXT,
            name_fr TEXT NOT NULL,
            name_ar TEXT NOT NULL,
            variant TEXT,
            size_weight TEXT,
            unit_of_measure TEXT DEFAULT 'UNIT',
            box_conversion_ratio REAL DEFAULT 1.0,
            purchase_cost INTEGER NOT NULL DEFAULT 0,
            selling_price_ttc INTEGER NOT NULL DEFAULT 0,
            min_selling_price_ttc INTEGER NOT NULL DEFAULT 0,
            tva_rate REAL DEFAULT 0.0,
            current_stock REAL NOT NULL DEFAULT 0.0 CHECK(current_stock >= 0.0),
            min_stock_alert REAL NOT NULL DEFAULT 5.0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    "#).execute(&mut *tx).await?;

    sqlx::query("INSERT INTO new_products SELECT * FROM products;").execute(&mut *tx).await?;
    sqlx::query("DROP TABLE products;").execute(&mut *tx).await?;
    sqlx::query("ALTER TABLE new_products RENAME TO products;").execute(&mut *tx).await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_prod_barcode ON products(barcode);").execute(&mut *tx).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_prod_sku ON products(sku);").execute(&mut *tx).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_prod_cat ON products(category_id);").execute(&mut *tx).await?;

    // PRODUCT_BATCHES
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS new_product_batches (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            batch_number TEXT NOT NULL,
            expiration_date TEXT NOT NULL,
            current_stock REAL NOT NULL DEFAULT 0.0 CHECK(current_stock >= 0.0),
            purchase_cost INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
    "#).execute(&mut *tx).await?;

    sqlx::query("INSERT INTO new_product_batches SELECT * FROM product_batches;").execute(&mut *tx).await?;
    sqlx::query("DROP TABLE product_batches;").execute(&mut *tx).await?;
    sqlx::query("ALTER TABLE new_product_batches RENAME TO product_batches;").execute(&mut *tx).await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_batch_fefo ON product_batches(product_id, expiration_date ASC);").execute(&mut *tx).await?;

    sqlx::query("PRAGMA legacy_alter_table = OFF;").execute(&mut *tx).await?;

    tx.commit().await?;
    Ok(())
}
