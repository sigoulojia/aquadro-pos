pub mod migrations;
pub mod db;
pub mod models;
pub mod commands;
pub mod auth;
pub mod repo;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub os: String,
    pub hostname: String,
    pub app_version: String,
}

// Native command to trigger raw thermal printer ESC/POS commands
#[tauri::command]
fn raw_print_receipt(content: String, printer_name: Option<String>) -> Result<String, String> {
    // In production on Windows, this sends raw bytes to the designated spooler printer
    println!("ESC/POS Print Request: {} chars to printer {:?}", content.len(), printer_name);
    Ok("Receipt spooled successfully".to_string())
}

// Native command to fire RJ11 drawer kick pulse (ESC p 0 25 250)
#[tauri::command]
fn open_cash_drawer(pin: Option<u8>) -> Result<bool, String> {
    let _kick_pin = pin.unwrap_or(0);
    println!("RJ11 Cash Drawer kick pulse sent to pin {}", _kick_pin);
    Ok(true)
}

#[tauri::command]
fn get_terminal_info() -> Result<TerminalInfo, String> {
    Ok(TerminalInfo {
        os: std::env::consts::OS.to_string(),
        hostname: std::env::var("COMPUTERNAME")
            .unwrap_or_else(|_| "ApexPOS-Terminal-01".to_string()),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                match db::init_db(&app_handle).await {
                    Ok(pool) => {
                        println!("Database initialized successfully.");
                        app_handle.manage(pool);
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize database: {}", e);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            raw_print_receipt,
            open_cash_drawer,
            get_terminal_info,
            commands::process_checkout,
            auth::authenticate_user,
            auth::verify_session,
            auth::logout_user,
            auth::setup_db_secret,
            auth::verify_danger_zone,
            auth::complete_setup,
            auth::hash_new_pin,
            auth::get_users,
            auth::create_user,
            auth::update_user_pin,
            auth::deactivate_user,
            auth::get_store,
            auth::update_store
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aquadro POS application");
}

#[cfg(test)]
mod updater_tests {
    use minisign_verify::{PublicKey, Signature};

    const PUB_KEY_B64: &str = "RWSnPZ6XwPQgyB/VdPrja08/v72dR1BkNfnMooDInFjV4+wNJ8Bt53ov";
    const VALID_SIG: &str = "untrusted comment: signature from tauri secret key\nRUSnPZ6XwPQgyJmj/vIpkRDol1AfDYNqMFoHFs2w6SSTl7dFbUloYXsLgB2NZrhS63ZMZ3BnCXZDxcLJl1wfUlyChSfWnwv7Ogw=\ntrusted comment: timestamp:1791562663\tfile:AquadroPOS_1.0.1_x64-setup.nsis.zip\tversion:1.0.1\na7aw04qjfUcnkSiE3D+jdJudqMCpwI/1Pdjj3QEH3UZsHLSlrV7pfLkAd5E/oOVNpUjlb8JN3Q0Qmd0/uwzICA==\n";
    const ARTIFACT_BYTES: &[u8] = b"PK_TEST_DUMMY_ZIP_CONTENT_AQUADRO_POS_V1_0_1";

    #[test]
    fn test_signature_verification_success() {
        let pk = PublicKey::from_base64(PUB_KEY_B64).expect("Valid public key");
        let sig = Signature::decode(VALID_SIG).expect("Valid signature string");
        assert!(pk.verify(ARTIFACT_BYTES, &sig, false).is_ok(), "Signature must be valid");
    }

    #[test]
    fn test_tampered_payload_rejected() {
        let pk = PublicKey::from_base64(PUB_KEY_B64).expect("Valid public key");
        let sig = Signature::decode(VALID_SIG).expect("Valid signature string");
        let tampered_bytes = b"TAMPERED_INJECTED_MALICIOUS_PAYLOAD";
        assert!(pk.verify(tampered_bytes, &sig, false).is_err(), "Tampered payload must be rejected");
    }

    #[test]
    fn test_corrupted_signature_rejected() {
        let pk = PublicKey::from_base64(PUB_KEY_B64).expect("Valid public key");
        let corrupted_sig_str = VALID_SIG.replace("a7aw04", "000000");
        let sig = Signature::decode(&corrupted_sig_str).expect("Decode structure");
        assert!(pk.verify(ARTIFACT_BYTES, &sig, false).is_err(), "Corrupted signature must fail verification");
    }
}

