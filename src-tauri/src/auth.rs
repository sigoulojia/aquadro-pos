    use argon2::{
        password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
        Argon2,
    };
    use chrono::{DateTime, Utc};
    use keyring::Entry;
    use lazy_static::lazy_static;
    use rand::{distributions::Alphanumeric, Rng};
    use serde::{Deserialize, Serialize};
    use sqlx::{FromRow, SqlitePool};
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    #[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
    pub struct SafeUser {
        pub id: String,
        pub name: String,
        pub role: String,
        pub store_id: Option<String>,
    }

    #[derive(Debug, Clone)]
    pub struct Session {
        pub token: String,
        pub user: SafeUser,
        pub expires_at: DateTime<Utc>,
    }

    #[derive(Debug, Serialize, Deserialize)]
    pub struct SessionResponse {
        pub token: String,
        pub user: SafeUser,
    }

    lazy_static! {
        static ref SESSION_STORE: Arc<RwLock<HashMap<String, Session>>> = Arc::new(RwLock::new(HashMap::new()));
        static ref RATE_LIMIT: Arc<RwLock<HashMap<String, (u32, DateTime<Utc>)>>> = Arc::new(RwLock::new(HashMap::new()));
    }

    fn generate_opaque_token() -> String {
        rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(64)
            .map(char::from)
            .collect()
    }

    pub async fn hash_pin(pin: &str) -> Result<String, String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(pin.as_bytes(), &salt)
            .map_err(|e| format!("Erreur de hachage: {}", e))?
            .to_string();
        Ok(password_hash)
    }

    pub async fn verify_pin(pin: &str, hash: &str) -> Result<bool, String> {
        if !hash.starts_with("$argon2") {
            return Ok(false);
        }
        let parsed_hash = PasswordHash::new(hash).map_err(|e| format!("Format hash invalide: {}", e))?;
        let argon2 = Argon2::default();
        Ok(argon2.verify_password(pin.as_bytes(), &parsed_hash).is_ok())
    }

    #[tauri::command]
    pub async fn authenticate_user(
        pin: String,
        pool: tauri::State<'_, SqlitePool>,
    ) -> Result<SessionResponse, String> {
        {
            let mut rate_limit = RATE_LIMIT.write().await;
            if let Some((attempts, lockout_until)) = rate_limit.get_mut("system") {
                if Utc::now() < *lockout_until {
                    return Err("Trop de tentatives. Veuillez patienter 5 minutes.".to_string());
                }
                if *attempts > 5 {
                    *lockout_until = Utc::now() + chrono::Duration::minutes(5);
                    *attempts = 0;
                    log_audit(&pool, "system", "AUTH_LOCKOUT", "Brute force attempt detected", "FAILED").await;
                    return Err("Compte verrouillé pour 5 minutes.".to_string());
                }
            }
        }

        let users = sqlx::query!("SELECT id, name, role, store_id, pin_hash FROM users WHERE is_active = 1")
            .fetch_all(&*pool)
            .await
            .map_err(|e| e.to_string())?;

        let mut matched_user = None;
        for u in users {
            if verify_pin(&pin, &u.pin_hash).await.unwrap_or(false) {
                matched_user = Some(SafeUser {
                    id: u.id.unwrap_or_default(),
                    name: u.name,
                    role: u.role,
                    store_id: u.store_id,
                });
                break;
            }
        }

        if let Some(user) = matched_user {
            RATE_LIMIT.write().await.remove("system");

            let token = generate_opaque_token();
            let session = Session {
                token: token.clone(),
                user: user.clone(),
                expires_at: Utc::now() + chrono::Duration::hours(12),
            };

            SESSION_STORE.write().await.insert(token.clone(), session);
            log_audit(&pool, &user.id, "LOGIN_SUCCESS", &format!("Utilisateur {} connecté", user.name), "SUCCESS").await;

            Ok(SessionResponse { token, user })
        } else {
            let mut rate_limit = RATE_LIMIT.write().await;
            let entry = rate_limit.entry("system".to_string()).or_insert((0, Utc::now()));
            entry.0 += 1;
            
            log_audit(&pool, "system", "LOGIN_FAILED", "Tentative PIN invalide", "FAILED").await;
            Err("Code PIN incorrect.".to_string())
        }
    }

    #[tauri::command]
    pub async fn verify_session(token: String) -> Result<SafeUser, String> {
        let store = SESSION_STORE.read().await;
        if let Some(session) = store.get(&token) {
            if Utc::now() > session.expires_at {
                return Err("Session expirée.".to_string());
            }
            Ok(session.user.clone())
        } else {
            Err("Non authentifié.".to_string())
        }
    }

    #[tauri::command]
    pub async fn logout_user(token: String, pool: tauri::State<'_, SqlitePool>) -> Result<(), String> {
        let mut store = SESSION_STORE.write().await;
        if let Some(session) = store.remove(&token) {
            log_audit(&pool, &session.user.id, "LOGOUT", "Déconnexion réussie", "SUCCESS").await;
        }
        Ok(())
    }

    const KEYRING_SERVICE: &str = "AquadroPOS_V2";
    const KEYRING_USERNAME: &str = "DB_SECRET_PIN";

    #[tauri::command]
    pub async fn setup_db_secret(secret: String, pool: tauri::State<'_, SqlitePool>) -> Result<(), String> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_USERNAME).map_err(|e| e.to_string())?;
        entry.set_password(&secret).map_err(|e| format!("Impossible de sauvegarder le code secret de manière sécurisée: {}", e))?;
        
        log_audit(&pool, "system", "DB_SECRET_SET", "Danger Zone PIN sécurisé dans le Keyring", "SUCCESS").await;
        Ok(())
    }

    #[tauri::command]
    pub async fn verify_danger_zone(secret: String, token: String, pool: tauri::State<'_, SqlitePool>) -> Result<bool, String> {
        let user = verify_session(token).await?;
        if user.role != "owner" {
            return Err("Accès non autorisé à la Danger Zone.".to_string());
        }

        let entry = Entry::new(KEYRING_SERVICE, KEYRING_USERNAME).map_err(|e| e.to_string())?;
        let stored_secret = entry.get_password().map_err(|_| "Code secret non configuré dans le Credential Manager.".to_string())?;
        
        if secret == stored_secret {
            log_audit(&pool, &user.id, "DANGER_ZONE_ACCESS", "Validation réussie", "SUCCESS").await;
            Ok(true)
        } else {
            log_audit(&pool, &user.id, "DANGER_ZONE_FAILED", "Échec de validation", "FAILED").await;
            Err("Code Secret Incorrect.".to_string())
        }
    }

    pub async fn log_audit(pool: &SqlitePool, user_id: &str, action: &str, details: &str, status: &str) {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let app_version = env!("CARGO_PKG_VERSION");
        
        let payload = format!(r#"{{"status":"{}","description":"{}","app_version":"{}"}}"#, status, details, app_version);
        
        let _ = sqlx::query!(
            r#"
            INSERT INTO audit_logs (id, user_id, action, entity_type, details, created_at) 
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
            id, user_id, action, "AUTH_EVENT", payload, now
        ).execute(pool).await;
    }

    #[derive(Deserialize)]
    pub struct SetupPayload {
        pub store_name_fr: String,
        pub store_name_ar: String,
        pub address: String,
        pub wilaya: String,
        pub commune: String,
        pub phone: String,
        pub rc: String,
        pub nif: String,
        pub nis: String,
        pub activity: String,
        pub fiscal_regime: String,
        pub tva_rate: f64,
        pub owner_name: String,
        pub owner_phone: String,
        pub owner_pin: String,
    }

    #[tauri::command]
    pub async fn complete_setup(payload: SetupPayload, pool: tauri::State<'_, SqlitePool>) -> Result<(), String> {
        let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
        
        let now = Utc::now().to_rfc3339();
        let pin_hash = hash_pin(&payload.owner_pin).await?;

        sqlx::query!("DELETE FROM stores").execute(&mut *tx).await.map_err(|e| e.to_string())?;
        
        sqlx::query!(
            r#"
            INSERT INTO stores (
              id, name_fr, name_ar, address, wilaya, commune,
              phone, rc_number, nif_number, nis_number,
              fiscal_regime, default_tva_rate, created_at, updated_at, ai_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            "store-alg-01", payload.store_name_fr, payload.store_name_ar, payload.address, payload.wilaya, payload.commune,
            payload.phone, payload.rc, payload.nif, payload.nis, payload.fiscal_regime, payload.tva_rate, now, now, "AI-0000"
        ).execute(&mut *tx).await.map_err(|e| e.to_string())?;

        sqlx::query!("DELETE FROM users").execute(&mut *tx).await.map_err(|e| e.to_string())?;

        sqlx::query!(
            r#"
            INSERT INTO users (id, name, role, pin_hash, phone, is_active, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            "usr-owner-01", payload.owner_name, "owner", pin_hash, payload.owner_phone, 1, now, now
        ).execute(&mut *tx).await.map_err(|e| e.to_string())?;

        tx.commit().await.map_err(|e| e.to_string())?;
        
        log_audit(&pool, "system", "SYSTEM_SETUP", "Initial setup completed", "SUCCESS").await;

        Ok(())
    }

    #[tauri::command]
    pub async fn hash_new_pin(pin: String) -> Result<String, String> {
        hash_pin(&pin).await
    }

    #[tauri::command]
    pub async fn get_users(token: String, pool: tauri::State<'_, SqlitePool>) -> Result<Vec<crate::models::User>, String> {
        let acting_user = verify_session(token).await?;
        if acting_user.role != "owner" {
            return Err("Non autorisé. Action réservée au propriétaire (Owner).".to_string());
        }

        sqlx::query_as::<_, crate::models::User>(
            r#"SELECT id, store_id, name, role, pin_hash, phone, is_active, created_at, updated_at FROM users WHERE is_active = 1 ORDER BY name ASC"#
        )
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn create_user(
        name: String,
        role: String,
        pin: String,
        phone: Option<String>,
        token: String,
        pool: tauri::State<'_, SqlitePool>
    ) -> Result<crate::models::User, String> {
        let acting_user = verify_session(token).await?;
        if acting_user.role != "owner" {
            return Err("Non autorisé. Action réservée au propriétaire (Owner).".to_string());
        }

        let pin_hash = hash_pin(&pin).await?;
        let id = format!("usr-{}", uuid::Uuid::new_v4().simple());
        let now = chrono::Utc::now().to_rfc3339();
        
        sqlx::query(
            r#"INSERT INTO users (id, name, role, pin_hash, phone, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)"#
        )
        .bind(&id).bind(&name).bind(&role).bind(&pin_hash).bind(&phone).bind(&now).bind(&now)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        
        let user = sqlx::query_as::<_, crate::models::User>(
            r#"SELECT id, store_id, name, role, pin_hash, phone, is_active, created_at, updated_at FROM users WHERE id = ?"#
        )
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        
        Ok(user)
    }

    #[tauri::command]
    pub async fn update_user_pin(id: String, pin: String, token: String, pool: tauri::State<'_, SqlitePool>) -> Result<(), String> {
        let acting_user = verify_session(token).await?;
        if acting_user.role != "owner" {
            return Err("Non autorisé. Action réservée au propriétaire (Owner).".to_string());
        }

        let pin_hash = hash_pin(&pin).await?;
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            r#"UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?"#
        )
        .bind(&pin_hash).bind(&now).bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[tauri::command]
    pub async fn deactivate_user(id: String, token: String, pool: tauri::State<'_, SqlitePool>) -> Result<(), String> {
        let acting_user = verify_session(token).await?;
        if acting_user.role != "owner" {
            return Err("Non autorisé. Action réservée au propriétaire (Owner).".to_string());
        }

        // Check if the user is an owner, and if so, prevent deactivation if they are the last one
        let target_user: Option<(String,)> = sqlx::query_as(
            r#"SELECT role FROM users WHERE id = ?"#
        )
        .bind(&id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| e.to_string())?;

        if let Some((role,)) = target_user {
            if role == "owner" {
                let active_owners: Option<(i64,)> = sqlx::query_as(
                    r#"SELECT COUNT(*) FROM users WHERE is_active = 1 AND role = 'owner'"#
                )
                .fetch_optional(&*pool)
                .await
                .map_err(|e| e.to_string())?;

                if let Some((count,)) = active_owners {
                    if count <= 1 {
                        return Err("Impossible de désactiver le dernier propriétaire actif du système.".to_string());
                    }
                }
            }
        }

        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            r#"UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?"#
        )
        .bind(&now).bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[tauri::command]
    pub async fn get_store(pool: tauri::State<'_, SqlitePool>) -> Result<crate::models::Store, String> {
        sqlx::query_as::<_, crate::models::Store>(
            r#"SELECT id, name_fr, name_ar, wilaya, commune, address, phone, email, rc_number, nif_number, nis_number, ai_number, fiscal_regime, default_tva_rate, receipt_header, receipt_footer, currency, is_active, created_at, updated_at FROM stores LIMIT 1"#
        )
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn update_store(
        store: crate::models::Store,
        pool: tauri::State<'_, SqlitePool>
    ) -> Result<(), String> {
        sqlx::query(
            r#"UPDATE stores SET 
                name_fr = ?, name_ar = ?, wilaya = ?, commune = ?, address = ?, phone = ?, 
                email = ?, rc_number = ?, nif_number = ?, nis_number = ?, ai_number = ?, 
                fiscal_regime = ?, default_tva_rate = ?, receipt_header = ?, receipt_footer = ?, 
                currency = ?, is_active = ?, updated_at = ?
            WHERE id = ?"#
        )
        .bind(&store.name_fr).bind(&store.name_ar).bind(&store.wilaya).bind(&store.commune)
        .bind(&store.address).bind(&store.phone).bind(&store.email).bind(&store.rc_number)
        .bind(&store.nif_number).bind(&store.nis_number).bind(&store.ai_number)
        .bind(&store.fiscal_regime).bind(&store.default_tva_rate).bind(&store.receipt_header)
        .bind(&store.receipt_footer).bind(&store.currency).bind(&store.is_active)
        .bind(&chrono::Utc::now().to_rfc3339()).bind(&store.id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[tokio::test]
        async fn test_argon2_hashing_and_verification() {
            let pin = "492015";
            let hash = hash_pin(pin).await.expect("Failed to hash PIN");
            
            // التحقق من أن خوارزمية Argon2id هي المستخدمة فعلياً
            assert!(hash.starts_with("$argon2id"), "Hash does not start with $argon2id");
            
            // التحقق من الـ PIN الصحيح
            let is_valid = verify_pin(pin, &hash).await.expect("Verification failed");
            assert!(is_valid, "Correct PIN should be verified");
            
            // التحقق من الـ PIN الخاطئ
            let is_invalid = verify_pin("123456", &hash).await.expect("Verification failed");
            assert!(!is_invalid, "Incorrect PIN should not be verified");
        }

        #[test]
        fn test_opaque_token_generation() {
            let token1 = generate_opaque_token();
            let token2 = generate_opaque_token();
            
            // طول الـ Token يجب أن يكون 64 حرف للحد من هجمات التخمين
            assert_eq!(token1.len(), 64, "Token should be exactly 64 characters");
            assert_ne!(token1, token2, "Tokens should be random and unique");
        }
    }
