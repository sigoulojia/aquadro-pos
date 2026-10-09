use sqlx::SqliteConnection;

pub struct CustomerRepo;

impl CustomerRepo {
    pub async fn add_debt(conn: &mut SqliteConnection, customer_id: &str, amount: i64) -> Result<(), String> {
        sqlx::query("UPDATE customers SET current_debt = current_debt + ? WHERE id = ?")
            .bind(amount)
            .bind(customer_id)
            .execute(&mut *conn).await.map_err(|e| e.to_string())?;
            
        Ok(())
    }
}
