use sqlx::{SqliteConnection, Row};
use uuid::Uuid;
use chrono::Utc;

pub struct InventoryRepo;

impl InventoryRepo {
    pub async fn allocate_and_deduct(conn: &mut SqliteConnection, product_id: &str, requested_qty: f64, user_id: &str) -> Result<(), String> {
        let now = Utc::now().to_rfc3339();

        // Check global stock
        let prod_row = sqlx::query("SELECT current_stock, purchase_cost FROM products WHERE id = ?")
            .bind(product_id)
            .fetch_optional(&mut *conn).await.map_err(|e| e.to_string())?;

        let (global_stock, purchase_cost): (f64, i64) = match prod_row {
            Some(r) => (r.get(0), r.get(1)),
            None => return Err("Product not found".to_string()),
        };

        if global_stock < requested_qty {
            return Err("Insufficient stock".to_string());
        }

        // Deduct Global Stock
        sqlx::query("UPDATE products SET current_stock = current_stock - ? WHERE id = ?")
            .bind(requested_qty)
            .bind(product_id)
            .execute(&mut *conn).await.map_err(|e| e.to_string())?;
            
        // FEFO allocation
        let batches = sqlx::query("SELECT id, current_stock, batch_number FROM product_batches WHERE product_id = ? AND current_stock > 0 ORDER BY expiration_date ASC")
            .bind(product_id)
            .fetch_all(&mut *conn).await.map_err(|e| e.to_string())?;
            
        let mut needed = requested_qty;
        
        for batch_row in batches {
            if needed <= 0.0 { break; }
            
            let batch_id: String = batch_row.get(0);
            let batch_stock: f64 = batch_row.get(1);
            let take = if batch_stock >= needed { needed } else { batch_stock };
            
            sqlx::query("UPDATE product_batches SET current_stock = current_stock - ? WHERE id = ?")
                .bind(take)
                .bind(&batch_id)
                .execute(&mut *conn).await.map_err(|e| e.to_string())?;
                
            // Insert Movement
            let mov_id = format!("mov-{}", Uuid::new_v4());
            sqlx::query(
                "INSERT INTO inventory_movements (id, product_id, batch_id, movement_type, quantity_change, previous_stock, new_stock, reason, unit_cost_snapshot, user_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&mov_id)
            .bind(product_id)
            .bind(&batch_id)
            .bind("SALE")
            .bind(-take)
            .bind(batch_stock)
            .bind(batch_stock - take)
            .bind("Sale Checkout")
            .bind(purchase_cost)
            .bind(user_id)
            .bind(&now)
            .execute(&mut *conn).await.map_err(|e| e.to_string())?;
            
            needed -= take;
        }

        if needed > 0.0 {
            let mov_id = format!("mov-{}", Uuid::new_v4());
            sqlx::query(
                "INSERT INTO inventory_movements (id, product_id, batch_id, movement_type, quantity_change, previous_stock, new_stock, reason, unit_cost_snapshot, user_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&mov_id)
            .bind(product_id)
            .bind(Option::<String>::None)
            .bind("SALE")
            .bind(-needed)
            .bind(global_stock)
            .bind(global_stock - requested_qty)
            .bind("Sale Checkout")
            .bind(purchase_cost)
            .bind(user_id)
            .bind(&now)
            .execute(&mut *conn).await.map_err(|e| e.to_string())?;
        }

        Ok(())
    }
}
