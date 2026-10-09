use super::tx::AquadroTx;
use super::inventory::InventoryRepo;
use super::customer::CustomerRepo;
use super::caisse::CaisseRepo;
use serde::{Serialize, Deserialize};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutItemInput {
    pub product_id: String,
    pub quantity: f64,
    pub unit_price_ttc: i64,
    pub discount_amount: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutPaymentInput {
    pub payment_method: String,
    pub amount: i64,
    pub tendered_amount: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessCheckoutPayload {
    pub idempotency_key: String,
    pub cashier_id: String,
    pub session_id: Option<String>,
    pub customer_id: Option<String>,
    pub items: Vec<CheckoutItemInput>,
    pub payments: Vec<CheckoutPaymentInput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessCheckoutResponse {
    pub sale_id: String,
    pub receipt_number: String,
    pub total_ttc: i64,
    pub change_given: i64,
}

pub struct CheckoutRepo;

impl CheckoutRepo {
    pub async fn process(tx: &mut AquadroTx, payload: ProcessCheckoutPayload) -> Result<ProcessCheckoutResponse, String> {
        let conn = tx.conn();

        // 1. Check idempotency constraint
        let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM sales WHERE idempotency_key = ?")
            .bind(&payload.idempotency_key)
            .fetch_optional(&mut *conn).await.map_err(|e| e.to_string())?;

        if let Some(row) = existing {
            return Ok(ProcessCheckoutResponse {
                sale_id: row.0,
                receipt_number: "".to_string(),
                total_ttc: 0,
                change_given: 0,
            });
        }

        let sale_id = format!("sale-{}", Uuid::new_v4());
        let receipt_number = format!("REC-{}-{:04}", Utc::now().format("%Y%m%d"), (rand::random::<u32>() % 9000 + 1000));
        let now = Utc::now().to_rfc3339();

        // Validate or resolve existing cashier_id
        let user_exists: Option<(String,)> = sqlx::query_as("SELECT id FROM users WHERE id = ?")
            .bind(&payload.cashier_id)
            .fetch_optional(&mut *conn).await.unwrap_or(None);

        let final_cashier_id = match user_exists {
            Some(u) => u.0,
            None => {
                let first_user: Option<(String,)> = sqlx::query_as("SELECT id FROM users LIMIT 1")
                    .fetch_optional(&mut *conn).await.unwrap_or(None);
                first_user.map(|u| u.0).unwrap_or_else(|| payload.cashier_id.clone())
            }
        };

        // Validate session_id
        let valid_session_id: Option<String> = match &payload.session_id {
            Some(s) if !s.trim().is_empty() => {
                let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM cash_sessions WHERE id = ?")
                    .bind(s)
                    .fetch_optional(&mut *conn).await.unwrap_or(None);
                exists.map(|e| e.0)
            },
            _ => None,
        };

        let mut total_ttc: i64 = 0;
        let mut subtotal_ht: i64 = 0;
        let mut total_discount: i64 = 0;
        let mut total_tax: i64 = 0;

        struct PreparedItem {
            sale_item_id: String,
            product_id: String,
            quantity: f64,
            unit_price_ttc: i64,
            discount_amount: i64,
            line_total: i64,
            purchase_cost: i64,
        }

        let mut prepared_items = Vec::new();

        // 2. Validate Products and calculate totals
        for item in &payload.items {
            if item.quantity <= 0.0 {
                return Err("Quantity must be greater than zero".to_string());
            }

            // Verify Product
            let product_row: Option<(i64, i64)> = sqlx::query_as("SELECT purchase_cost, selling_price_ttc FROM products WHERE id = ? AND is_active = 1")
                .bind(&item.product_id)
                .fetch_optional(&mut *conn).await.map_err(|e| e.to_string())?;

            let (purchase_cost, _selling_price) = match product_row {
                Some(p) => (p.0, p.1),
                None => return Err(format!("Product {} not found or inactive", item.product_id)),
            };

            let line_total = (item.quantity * (item.unit_price_ttc as f64)).round() as i64 - item.discount_amount;
            total_ttc += line_total;
            total_discount += item.discount_amount;

            // Derived HT logic (assuming 19% embedded)
            let ht = (line_total as f64 / 1.19).round() as i64;
            subtotal_ht += ht;
            total_tax += line_total - ht;

            prepared_items.push(PreparedItem {
                sale_item_id: format!("item-{}", Uuid::new_v4()),
                product_id: item.product_id.clone(),
                quantity: item.quantity,
                unit_price_ttc: item.unit_price_ttc,
                discount_amount: item.discount_amount,
                line_total,
                purchase_cost,
            });
        }

        // 3. Process and validate Payments
        let mut total_payments = 0;
        let mut change_given = 0;
        let mut is_credit = false;
        
        let mut total_cash_sales = 0;
        let mut total_card_sales = 0;
        let mut total_qr_sales = 0;
        let mut total_credit_sales = 0;

        struct PreparedPayment {
            payment_id: String,
            method: String,
            amount: i64,
            tendered: i64,
            change: i64,
        }

        let mut prepared_payments = Vec::new();

        for p in &payload.payments {
            total_payments += p.amount;
            
            let mut payment_change = 0;
            if p.payment_method == "CASH" {
                payment_change = p.tendered_amount - p.amount;
                change_given += payment_change;
                total_cash_sales += p.amount;
            } else if p.payment_method == "CREDIT" {
                is_credit = true;
                total_credit_sales += p.amount;
            } else if p.payment_method == "CIB" || p.payment_method == "EDAHABIA" || p.payment_method == "CARD" {
                total_card_sales += p.amount;
            } else if p.payment_method == "BARIDIMOB" {
                total_qr_sales += p.amount;
            }

            prepared_payments.push(PreparedPayment {
                payment_id: format!("pay-{}", Uuid::new_v4()),
                method: p.payment_method.clone(),
                amount: p.amount,
                tendered: p.tendered_amount,
                change: payment_change,
            });
        }

        if total_payments != total_ttc {
            return Err("Payments do not match total TTC".to_string());
        }

        if is_credit && payload.customer_id.is_none() {
            return Err("Credit sale requires a customer".to_string());
        }

        // 4. INSERT INTO sales FIRST (Parent record for foreign keys)
        sqlx::query(
            "INSERT INTO sales (id, receipt_number, session_id, cashier_id, customer_id, subtotal_ht, discount_amount, tax_amount, total_ttc, status, idempotency_key, sync_status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&sale_id)
        .bind(&receipt_number)
        .bind(&valid_session_id)
        .bind(&final_cashier_id)
        .bind(&payload.customer_id)
        .bind(subtotal_ht)
        .bind(total_discount)
        .bind(total_tax)
        .bind(total_ttc)
        .bind("COMPLETED")
        .bind(&payload.idempotency_key)
        .bind("PENDING")
        .bind(&now)
        .execute(&mut *conn).await.map_err(|e| e.to_string())?;

        // 5. INSERT INTO sale_items & allocate inventory
        for pi in prepared_items {
            sqlx::query(
                "INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price_ttc, discount_amount, total_ttc, unit_purchase_cost_snapshot, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&pi.sale_item_id)
            .bind(&sale_id)
            .bind(&pi.product_id)
            .bind(pi.quantity)
            .bind(pi.unit_price_ttc)
            .bind(pi.discount_amount)
            .bind(pi.line_total)
            .bind(pi.purchase_cost)
            .bind(&now)
            .execute(&mut *conn).await.map_err(|e| e.to_string())?;

            // FEFO Allocation
            InventoryRepo::allocate_and_deduct(conn, &pi.product_id, pi.quantity, &final_cashier_id).await?;
        }

        // 6. INSERT INTO payments
        for pp in prepared_payments {
            sqlx::query(
                "INSERT INTO payments (id, sale_id, payment_method, amount, tendered_amount, change_given, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&pp.payment_id)
            .bind(&sale_id)
            .bind(&pp.method)
            .bind(pp.amount)
            .bind(pp.tendered)
            .bind(pp.change)
            .bind(&now)
            .execute(&mut *conn).await.map_err(|e| e.to_string())?;
        }

        // 7. Handle Credit Debt
        if is_credit {
            if let Some(cust_id) = &payload.customer_id {
                CustomerRepo::add_debt(conn, cust_id, total_credit_sales).await?;
            }
        }

        // 8. Update Cash Session if valid
        if let Some(ref sess_id) = valid_session_id {
            CaisseRepo::update_session(conn, sess_id, total_cash_sales, total_card_sales, total_qr_sales, total_credit_sales).await?;
        }

        // 9. Outbox sync operation recording
        let sync_op_id = format!("sync-{}", Uuid::new_v4());
        let sync_payload = serde_json::json!({
            "sale_id": &sale_id,
            "receipt_number": &receipt_number,
            "total_ttc": total_ttc,
            "created_at": &now
        }).to_string();

        let _ = sqlx::query(
            "INSERT INTO sync_operations (id, table_name, record_id, action, payload, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&sync_op_id)
        .bind("sales")
        .bind(&sale_id)
        .bind("INSERT")
        .bind(&sync_payload)
        .bind("PENDING")
        .bind(&now)
        .execute(&mut *conn).await;

        Ok(ProcessCheckoutResponse {
            sale_id,
            receipt_number,
            total_ttc,
            change_given,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions, SqliteJournalMode};
    use sqlx::Row;
    use std::str::FromStr;

    async fn setup_test_pool() -> sqlx::SqlitePool {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join(format!("test_checkout_{}.db", Uuid::new_v4()));
        let db_url = format!("sqlite:{}?mode=rwc", db_path.display().to_string().replace('\\', "/"));

        let options = SqliteConnectOptions::from_str(&db_url).unwrap()
            .create_if_missing(true)
            .foreign_keys(true)
            .journal_mode(SqliteJournalMode::Wal)
            .busy_timeout(std::time::Duration::from_millis(5000));

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await.unwrap();

        let schema = include_str!("../../../src/db/schema.sql");
        sqlx::query(schema).execute(&pool).await.unwrap();

        // Seed store and cashier user
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO stores (id, name_fr, name_ar, wilaya, commune, address, phone, rc_number, nif_number, nis_number, ai_number, created_at, updated_at)
             VALUES ('str-01', 'Aquadro Nutrition', 'أكوادرو', 'Alger', 'Alger', 'Rue 1', '0550000000', 'RC-01', 'NIF-01', 'NIS-01', 'AI-01', ?, ?)"
        )
        .bind(&now)
        .bind(&now)
        .execute(&pool).await.unwrap();

        sqlx::query(
            "INSERT INTO users (id, store_id, name, role, pin_hash, created_at, updated_at)
             VALUES ('usr-test-01', 'str-01', 'Test Cashier', 'cashier', 'salt:hash', ?, ?)"
        )
        .bind(&now)
        .bind(&now)
        .execute(&pool).await.unwrap();

        pool
    }

    #[tokio::test]
    async fn test_full_pos_checkout_lifecycle() {
        let pool = setup_test_pool().await;
        let now = Utc::now().to_rfc3339();

        // 1. Create a Product with batch
        let prod_id = format!("prod-{}", Uuid::new_v4());
        let batch_id = format!("batch-{}", Uuid::new_v4());

        sqlx::query(
            "INSERT INTO products (id, store_id, sku, barcode, name_fr, name_ar, purchase_cost, selling_price_ttc, current_stock, created_at, updated_at)
             VALUES (?, 'str-01', 'SKU-SMOKE', 'BAR-SMOKE-123', 'Whey Smoke 2kg', 'واي سموك', 10000, 15000, 20.0, ?, ?)"
        )
        .bind(&prod_id)
        .bind(&now)
        .bind(&now)
        .execute(&pool).await.unwrap();

        sqlx::query(
            "INSERT INTO product_batches (id, product_id, batch_number, expiration_date, current_stock, purchase_cost, created_at)
             VALUES (?, ?, 'LOT-SMOKE-01', '2028-01-01', 20.0, 10000, ?)"
        )
        .bind(&batch_id)
        .bind(&prod_id)
        .bind(&now)
        .execute(&pool).await.unwrap();

        // 2. Read and verify product
        let row = sqlx::query("SELECT name_fr, current_stock, selling_price_ttc FROM products WHERE id = ?")
            .bind(&prod_id)
            .fetch_one(&pool).await.unwrap();
        let name: String = row.get(0);
        let stock: f64 = row.get(1);
        let price: i64 = row.get(2);
        assert_eq!(name, "Whey Smoke 2kg");
        assert_eq!(stock, 20.0);
        assert_eq!(price, 15000);

        // 3. Update Product
        sqlx::query("UPDATE products SET selling_price_ttc = 15500 WHERE id = ?")
            .bind(&prod_id)
            .execute(&pool).await.unwrap();

        let updated_row = sqlx::query("SELECT selling_price_ttc FROM products WHERE id = ?")
            .bind(&prod_id)
            .fetch_one(&pool).await.unwrap();
        let updated_price: i64 = updated_row.get(0);
        assert_eq!(updated_price, 15500);

        // 4. Execute atomic Checkout via CheckoutRepo
        let mut tx = AquadroTx::begin_immediate_with_retry(&pool, 3).await.unwrap();
        let payload = ProcessCheckoutPayload {
            idempotency_key: format!("idem-{}", Uuid::new_v4()),
            cashier_id: "usr-test-01".to_string(),
            session_id: None,
            customer_id: None,
            items: vec![
                CheckoutItemInput {
                    product_id: prod_id.clone(),
                    quantity: 2.0,
                    unit_price_ttc: 15500,
                    discount_amount: 0,
                }
            ],
            payments: vec![
                CheckoutPaymentInput {
                    payment_method: "CASH".to_string(),
                    amount: 31000,
                    tendered_amount: 32000,
                }
            ],
        };

        let resp = CheckoutRepo::process(&mut tx, payload).await.unwrap();
        tx.commit().await.unwrap();

        // 5. Verify Checkout outputs
        assert!(!resp.sale_id.is_empty());
        assert!(resp.receipt_number.starts_with("REC-"));
        assert_eq!(resp.total_ttc, 31000);
        assert_eq!(resp.change_given, 1000);

        // 6. Verify inventory decremented in products and product_batches
        let prod_after = sqlx::query("SELECT current_stock FROM products WHERE id = ?")
            .bind(&prod_id)
            .fetch_one(&pool).await.unwrap();
        let stock_after: f64 = prod_after.get(0);
        assert_eq!(stock_after, 18.0); // 20.0 - 2.0 = 18.0

        let batch_after = sqlx::query("SELECT current_stock FROM product_batches WHERE id = ?")
            .bind(&batch_id)
            .fetch_one(&pool).await.unwrap();
        let batch_stock_after: f64 = batch_after.get(0);
        assert_eq!(batch_stock_after, 18.0); // 20.0 - 2.0 = 18.0

        // 7. Verify sale record and sale_items with purchase cost snapshot
        let sale_row = sqlx::query("SELECT receipt_number, total_ttc, status, sync_status FROM sales WHERE id = ?")
            .bind(&resp.sale_id)
            .fetch_one(&pool).await.unwrap();
        assert_eq!(sale_row.get::<String, _>(0), resp.receipt_number);
        assert_eq!(sale_row.get::<i64, _>(1), 31000);
        assert_eq!(sale_row.get::<String, _>(2), "COMPLETED");
        assert_eq!(sale_row.get::<String, _>(3), "PENDING");

        let item_row = sqlx::query("SELECT quantity, unit_price_ttc, total_ttc, unit_purchase_cost_snapshot FROM sale_items WHERE sale_id = ?")
            .bind(&resp.sale_id)
            .fetch_one(&pool).await.unwrap();
        assert_eq!(item_row.get::<f64, _>(0), 2.0);
        assert_eq!(item_row.get::<i64, _>(1), 15500);
        assert_eq!(item_row.get::<i64, _>(2), 31000);
        assert_eq!(item_row.get::<i64, _>(3), 10000); // Historical cost snapshot

        // 8. Verify inventory movements
        let mov_row = sqlx::query("SELECT movement_type, quantity_change, user_id, unit_cost_snapshot FROM inventory_movements WHERE product_id = ?")
            .bind(&prod_id)
            .fetch_one(&pool).await.unwrap();
        assert_eq!(mov_row.get::<String, _>(0), "SALE");
        assert_eq!(mov_row.get::<f64, _>(1), -2.0);
        assert_eq!(mov_row.get::<String, _>(2), "usr-test-01");
        assert_eq!(mov_row.get::<i64, _>(3), 10000);

        // 9. Verify sync_operations outbox
        let sync_row = sqlx::query("SELECT table_name, action, status FROM sync_operations WHERE record_id = ?")
            .bind(&resp.sale_id)
            .fetch_one(&pool).await.unwrap();
        assert_eq!(sync_row.get::<String, _>(0), "sales");
        assert_eq!(sync_row.get::<String, _>(1), "INSERT");
        assert_eq!(sync_row.get::<String, _>(2), "PENDING");

        // 10. Delete verification
        sqlx::query("DELETE FROM sale_items WHERE sale_id = ?").bind(&resp.sale_id).execute(&pool).await.unwrap();
        sqlx::query("DELETE FROM payments WHERE sale_id = ?").bind(&resp.sale_id).execute(&pool).await.unwrap();
        sqlx::query("DELETE FROM sales WHERE id = ?").bind(&resp.sale_id).execute(&pool).await.unwrap();
        sqlx::query("DELETE FROM inventory_movements WHERE product_id = ?").bind(&prod_id).execute(&pool).await.unwrap();
        sqlx::query("DELETE FROM product_batches WHERE id = ?").bind(&batch_id).execute(&pool).await.unwrap();
        sqlx::query("DELETE FROM products WHERE id = ?").bind(&prod_id).execute(&pool).await.unwrap();

        let count: i64 = sqlx::query("SELECT count(*) FROM products WHERE id = ?")
            .bind(&prod_id)
            .fetch_one(&pool).await.unwrap().get(0);
        assert_eq!(count, 0);
    }
}
