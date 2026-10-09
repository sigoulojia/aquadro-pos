use sqlx::SqlitePool;
use tauri::State;
use crate::repo::checkout::{ProcessCheckoutPayload, ProcessCheckoutResponse, CheckoutRepo};
use crate::repo::tx::AquadroTx;

#[tauri::command]
pub async fn process_checkout(
    payload: ProcessCheckoutPayload,
    pool: State<'_, SqlitePool>,
) -> Result<ProcessCheckoutResponse, String> {
    
    // 1. Begin atomic transaction with lock retry for busy handling
    let mut tx = AquadroTx::begin_immediate_with_retry(&pool, 3)
        .await
        .map_err(|e| e.to_string())?;

    // 2. Delegate to Checkout repository to execute full logic
    let response = CheckoutRepo::process(&mut tx, payload).await?;

    // 3. Commit transaction
    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(response)
}
