use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub store_id: Option<String>,
    pub name: String,
    pub role: String,
    pub pin_hash: String,
    pub phone: Option<String>,
    pub is_active: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Product {
    pub id: String,
    pub sku: String,
    pub barcode: String,
    pub name_fr: String,
    pub name_ar: String,
    pub purchase_cost: i64,
    pub selling_price_ttc: i64,
    pub min_selling_price_ttc: i64,
    pub tva_rate: f64,
    pub current_stock: f64,
    pub min_stock_alert: f64,
    pub is_active: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Sale {
    pub id: String,
    pub receipt_number: String,
    pub session_id: Option<String>,
    pub cashier_id: String,
    pub customer_id: Option<String>,
    pub subtotal_ht: i64,
    pub discount_amount: i64,
    pub tax_amount: i64,
    pub total_ttc: i64,
    pub status: String,
    pub idempotency_key: String,
    pub sync_status: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Store {
    pub id: String,
    pub name_fr: String,
    pub name_ar: String,
    pub wilaya: String,
    pub commune: String,
    pub address: String,
    pub phone: String,
    pub email: Option<String>,
    pub rc_number: String,
    pub nif_number: String,
    pub nis_number: String,
    pub ai_number: String,
    pub fiscal_regime: String,
    pub default_tva_rate: f64,
    pub receipt_header: Option<String>,
    pub receipt_footer: Option<String>,
    pub currency: Option<String>,
    pub is_active: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}
