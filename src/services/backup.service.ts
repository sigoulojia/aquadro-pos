// Aquadro POS Algérie V2 — Service de Sauvegarde & Restauration Locale
// Sauvegardes locales automatiques, export et restauration protégée par PIN Propriétaire

import { db } from '../db/sqlite';
import { authService } from './auth.service';

export interface BackupMetadata {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  tableCounts: Record<string, number>;
}

export class BackupService {
  private static instance: BackupService;

  private constructor() {}

  public static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  // Créer une sauvegarde instantanée
  public async createBackup(): Promise<BackupMetadata> {
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

    const data = JSON.stringify(tablesData);
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-');
    const filename = `aquadro_backup_${dateStr}.json`;

    const metadata: BackupMetadata = {
      id: `bkp-${Date.now()}`,
      filename,
      createdAt: now.toISOString(),
      sizeBytes: new Blob([data]).size,
      tableCounts
    };

    // Téléchargement / écriture fichier
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

    // Inscrire dans l'audit log
    const user = authService.getCurrentUser();
    await db.execute(
      `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `audit-${Date.now()}`,
        user?.id || 'system',
        user?.name || 'Système',
        'BACKUP_CREATED',
        'SYSTEM',
        `Sauvegarde locale créée : ${filename} (${metadata.sizeBytes} octets)`,
        new Date().toISOString()
      ]
    );

    return metadata;
  }

  // Restauration de base de données protégée par le PIN Propriétaire
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
