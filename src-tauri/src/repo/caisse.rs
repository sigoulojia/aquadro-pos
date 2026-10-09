use sqlx::SqliteConnection;

pub struct CaisseRepo;

impl CaisseRepo {
    pub async fn update_session(conn: &mut SqliteConnection, session_id: &str, cash_sales: i64, card_sales: i64, qr_sales: i64, credit_sales: i64) -> Result<(), String> {
        sqlx::query(
            "UPDATE cash_sessions SET 
             total_cash_sales = total_cash_sales + ?, 
             total_card_sales = total_card_sales + ?, 
             total_qr_sales = total_qr_sales + ?, 
             total_credit_sales = total_credit_sales + ?, 
             expected_cash_drawer = expected_cash_drawer + ? 
             WHERE id = ?"
        )
        .bind(cash_sales)
        .bind(card_sales)
        .bind(qr_sales)
        .bind(credit_sales)
        .bind(cash_sales) // only cash increases drawer
        .bind(session_id)
        .execute(&mut *conn).await.map_err(|e| e.to_string())?;
        
        Ok(())
    }
}
