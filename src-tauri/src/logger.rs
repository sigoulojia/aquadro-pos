use chrono::{Duration, Local, Utc};
use lazy_static::lazy_static;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "WARN" | "WARNING" => LogLevel::Warn,
            "ERROR" | "CRITICAL" | "FATAL" => LogLevel::Error,
            _ => LogLevel::Info,
        }
    }
}

pub struct Logger {
    logs_dir: Option<PathBuf>,
}

lazy_static! {
    static ref GLOBAL_LOGGER: Mutex<Logger> = Mutex::new(Logger { logs_dir: None });
}

/// Initialize the logger with the application's logs directory
pub fn init_logger(logs_dir: PathBuf) -> Result<(), String> {
    fs::create_dir_all(&logs_dir).map_err(|e| format!("Failed to create logs dir: {}", e))?;
    
    // Setup panic hook to log unexpected crashes to crash.log
    let crash_dir = logs_dir.clone();
    std::panic::set_hook(Box::new(move |panic_info| {
        let timestamp = Utc::now().to_rfc3339();
        let payload = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic payload".to_string()
        };
        let location = panic_info.location().map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column())).unwrap_or_else(|| "unknown".to_string());
        
        let crash_msg = format!("[{}] [CRITICAL_PANIC] Location: {} | Message: {}\n", timestamp, location, payload);
        eprintln!("{}", crash_msg);
        
        let crash_file = crash_dir.join("crash.log");
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&crash_file) {
            let _ = file.write_all(crash_msg.as_bytes());
        }
    }));

    // Rotate and clean old logs (> 14 days)
    clean_old_logs(&logs_dir, 14);

    let mut logger = GLOBAL_LOGGER.lock().unwrap();
    logger.logs_dir = Some(logs_dir);
    
    Ok(())
}

/// Sanitize sensitive data (PINs, passwords, card numbers) from log messages
pub fn sanitize_message(msg: &str) -> String {
    let mut sanitized = msg.to_string();
    
    // Mask potential 4-digit or 6-digit numeric PINs in key-value pairs (e.g. pin=1234 or "pin":"1234")
    let pin_patterns = ["pin\":", "pin=", "pin_hash\":", "password\":", "password="];
    for pattern in &pin_patterns {
        if let Some(pos) = sanitized.find(pattern) {
            let start = pos + pattern.len();
            let end = (start + 20).min(sanitized.len());
            let masked = format!("{}[REDACTED]", pattern);
            sanitized = format!("{}{}{}", &sanitized[..pos], masked, &sanitized[end..]);
        }
    }
    
    // Mask credit card-like 16-digit sequences (Luhn-like patterns)
    let words: Vec<String> = sanitized.split_whitespace().map(|w| {
        let clean: String = w.chars().filter(|c| c.is_ascii_digit()).collect();
        if (clean.len() == 16 || clean.len() == 19) && (clean.starts_with('4') || clean.starts_with('5') || clean.starts_with('6')) {
            format!("****-****-****-{}", &clean[clean.len()-4..])
        } else {
            w.to_string()
        }
    }).collect();

    words.join(" ")
}

/// Append a log entry to the active daily log file
pub fn log(level: LogLevel, target: &str, message: &str) {
    let now = Local::now();
    let timestamp = now.format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    let sanitized_msg = sanitize_message(message);
    let log_line = format!("[{}] [{}] [{}] {}\n", timestamp, level.as_str(), target, sanitized_msg);

    // Print to console in dev mode
    print!("{}", log_line);

    let logger = GLOBAL_LOGGER.lock().unwrap();
    if let Some(ref dir) = logger.logs_dir {
        let date_str = now.format("%Y-%m-%d").to_string();
        let log_file_name = format!("aquadro_{}.log", date_str);
        let log_file_path = dir.join(log_file_name);

        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_file_path) {
            let _ = file.write_all(log_line.as_bytes());
        }
    }
}

pub fn log_info(target: &str, message: &str) {
    log(LogLevel::Info, target, message);
}

pub fn log_warn(target: &str, message: &str) {
    log(LogLevel::Warn, target, message);
}

pub fn log_error(target: &str, message: &str) {
    log(LogLevel::Error, target, message);
}

/// Clean up log files older than max_days
fn clean_old_logs(logs_dir: &Path, max_days: i64) {
    let cutoff = Local::now() - Duration::days(max_days);
    if let Ok(entries) = fs::read_dir(logs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("aquadro_") && name.ends_with(".log") {
                        if let Ok(metadata) = entry.metadata() {
                            if let Ok(modified) = metadata.modified() {
                                let modified_dt: chrono::DateTime<Local> = modified.into();
                                if modified_dt < cutoff {
                                    let _ = fs::remove_file(&path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Tauri Command: Unified frontend logging bridge
#[tauri::command]
pub fn log_event(level: String, category: String, message: String, details: Option<String>) {
    let lvl = LogLevel::from_str(&level);
    let full_msg = match details {
        Some(d) if !d.is_empty() => format!("{} | details: {}", message, d),
        _ => message,
    };
    log(lvl, &category, &full_msg);
}

/// Tauri Command: Read recent log lines for in-app diagnostics
#[tauri::command]
pub fn get_recent_logs(lines: Option<usize>) -> Result<Vec<String>, String> {
    let logger = GLOBAL_LOGGER.lock().unwrap();
    let dir = logger.logs_dir.as_ref().ok_or("Logger not initialized")?;
    
    let now = Local::now();
    let date_str = now.format("%Y-%m-%d").to_string();
    let log_file_path = dir.join(format!("aquadro_{}.log", date_str));

    if !log_file_path.exists() {
        return Ok(vec!["Aucun fichier de journalisation actif pour aujourd'hui.".to_string()]);
    }

    let content = fs::read_to_string(&log_file_path).map_err(|e| e.to_string())?;
    let all_lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    let take_count = lines.unwrap_or(100);
    
    let start_idx = all_lines.len().saturating_sub(take_count);
    Ok(all_lines[start_idx..].to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_message_pins_and_cards() {
        let input = "User entered pin=1234 on device";
        let sanitized = sanitize_message(input);
        assert!(!sanitized.contains("1234"), "PIN must be redacted");
        assert!(sanitized.contains("[REDACTED]"));

        let card_input = "Charged card 4111111111111234 successfully";
        let sanitized_card = sanitize_message(card_input);
        assert!(!sanitized_card.contains("4111111111111234"), "Card number must be masked");
        assert!(sanitized_card.contains("****-****-****-1234"));
    }

    #[test]
    fn test_log_level_parsing() {
        assert_eq!(LogLevel::from_str("INFO"), LogLevel::Info);
        assert_eq!(LogLevel::from_str("warn"), LogLevel::Warn);
        assert_eq!(LogLevel::from_str("ERROR"), LogLevel::Error);
        assert_eq!(LogLevel::from_str("CRITICAL"), LogLevel::Error);
    }
}
