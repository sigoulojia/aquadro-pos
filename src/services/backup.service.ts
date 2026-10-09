// Aquadro POS — Runtime & Backup Service
// Interface unifiée avec le moteur natif Rust de sauvegarde atomique SQLite (VACUUM INTO),
// intégrité de la base (PRAGMA integrity_check) et migration JSON protégée par PIN Propriétaire.

import { db } from '../db/sqlite';
import { authService } from './auth.service';

export interface RuntimePathsInfo {
  app_data_dir: string;
  database_path: string;
  logs_dir: string;
  backups_dir: string;
  config_dir: string;
}

export interface BackupInfo {
  filename: string;
  filepath: string;
  size_bytes: number;
  created_at: string;
  is_valid: boolean;
}

export interface IntegrityReport {
  is_healthy: boolean;
  checks: string[];
}

export interface JsonBackupMetadata {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  tableCounts: Record<string, number>;
}

export class BackupService {
  private static instance: BackupService;
  private isTauri = false;

  private constructor() {
    this.isTauri = typeof window !== 'undefined' && typeof (window as any).__TAURI_INTERNALS__?.invoke === 'function';
  }

  public static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  /**
   * Récupère les chemins système AppData résolus
   */
  public async getRuntimePaths(): Promise<RuntimePathsInfo | null> {
    if (!this.isTauri) {
      return {
        app_data_dir: 'Navigateur / LocalStorage',
        database_path: 'aquadro_v2.db',
        logs_dir: 'Navigateur Console',
        backups_dir: 'Téléchargements',
        config_dir: 'LocalStorage',
      };
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<RuntimePathsInfo>('get_runtime_paths');
    } catch (err) {
      console.warn('[BackupService] Impossible d\'obtenir les chemins runtime:', err);
      return null;
    }
  }

  /**
   * Crée un instantané atomique natif SQLite (VACUUM INTO) dans AppData/backups/
   */
  public async createBackup(label?: string): Promise<BackupInfo | null> {
    if (this.isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<BackupInfo>('create_database_backup', { label: label || 'manual' });
      } catch (err) {
        console.error('[BackupService] Échec création de sauvegarde native:', err);
        throw err;
      }
    } else {
      // Mode web / secours : génère un fichier JSON
      const jsonMeta = await this.exportJsonBackup();
      return {
        filename: jsonMeta.filename,
        filepath: 'Downloads/' + jsonMeta.filename,
        size_bytes: jsonMeta.sizeBytes,
        created_at: jsonMeta.createdAt,
        is_valid: true,
      };
    }
  }

  /**
   * Liste les sauvegardes physiques présentes dans AppData/backups/
   */
  public async listBackups(): Promise<BackupInfo[]> {
    if (!this.isTauri) return [];
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<BackupInfo[]>('list_database_backups');
    } catch (err) {
      console.warn('[BackupService] Échec liste des sauvegardes:', err);
      return [];
    }
  }

  /**
   * Exécute un diagnostic d'intégrité de la base de données
   */
  public async verifyDatabaseIntegrity(): Promise<IntegrityReport> {
    if (!this.isTauri) {
      return { is_healthy: true, checks: ['Mode mémoire / simulateur'] };
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<IntegrityReport>('verify_database_integrity');
    } catch (err) {
      console.error('[BackupService] Échec vérification d\'intégrité:', err);
      return { is_healthy: false, checks: [String(err)] };
    }
  }

  /**
   * Exporte un dump structuré au format JSON pour portabilité ou archivage externe
   */
  public async exportJsonBackup(): Promise<JsonBackupMetadata> {
    const tableNames = [
      'stores', 'roles', 'permissions', 'users', 'categories', 'brands', 'suppliers',
      'products', 'customers', 'product_batches', 'inventory_movements', 'sales',
      'sale_items', 'payments', 'refunds', 'refund_items', 'purchases', 'purchase_items',
      'expenses', 'cash_sessions', 'customer_payments', 'supplier_payments',
      'commercial_documents', 'document_sequences', 'audit_logs', 'sync_operations'
    ];

    const tablesData: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};

    for (const table of tableNames) {
      try {
        const rows = await db.select(`SELECT * FROM ${table}`);
        tablesData[table] = rows;
        tableCounts[table] = rows.length;
      } catch {
        tablesData[table] = [];
        tableCounts[table] = 0;
      }
    }

    const data = JSON.stringify(tablesData, null, 2);
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-');
    const filename = `aquadro_backup_${dateStr}.json`;

    const metadata: JsonBackupMetadata = {
      id: `bkp-${Date.now()}`,
      filename,
      createdAt: now.toISOString(),
      sizeBytes: new Blob([data]).size,
      tableCounts
    };

    if (typeof document !== 'undefined') {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    const user = authService.getCurrentUser();
    await db.execute(
      `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `audit-${Date.now()}`,
        user?.id || 'system',
        user?.name || 'Système',
        'BACKUP_JSON_EXPORTED',
        'SYSTEM',
        `Sauvegarde JSON exportée : ${filename} (${metadata.sizeBytes} octets)`,
        new Date().toISOString()
      ]
    );

    return metadata;
  }

  /**
   * Restauration de la base depuis un fichier JSON, strictement protégée par le PIN Propriétaire
   */
  public async restoreBackup(jsonData: string, ownerPin: string): Promise<boolean> {
    const pinCheck = await authService.verifyManagerOrOwnerPin(ownerPin);
    if (!pinCheck.valid || pinCheck.user?.role !== 'owner') {
      throw new Error('Action non autorisée : La restauration nécessite impérativement le code PIN du Propriétaire (Owner).');
    }

    try {
      const parsed = JSON.parse(jsonData);
      if (typeof parsed !== 'object' || !parsed.products || !parsed.stores) {
        throw new Error('Fichier de sauvegarde corrompu ou incompatible avec Aquadro POS V2.');
      }

      await db.resetAll();

      for (const [table, rows] of Object.entries(parsed)) {
        if (Array.isArray(rows)) {
          for (const row of rows) {
            const keys = Object.keys(row);
            if (keys.length > 0) {
              const placeholders = keys.map(() => '?').join(', ');
              const values = keys.map(k => (row as any)[k]);
              await db.execute(
                `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
                values
              ).catch(() => {});
            }
          }
        }
      }

      await db.execute(
        `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit-${Date.now()}`,
          pinCheck.user.id,
          pinCheck.user.name,
          'DATABASE_RESTORED',
          'SYSTEM',
          'Base de données restaurée avec succès depuis une sauvegarde externe',
          new Date().toISOString()
        ]
      );

      return true;
    } catch (err: any) {
      throw new Error(`Échec de restauration : ${err.message}`);
    }
  }
}

export const backupService = BackupService.getInstance();
