// Aquadro POS Algérie V2 — Moteur de Base de Données SQLite Local
// TRANSITIONAL COMPATIBILITY BRIDGE:
// tauri-plugin-sql est utilisé temporairement pour réconcilier le frontend avec
// la base SQLite native autoritaire gérée par Rust (AppData/aquadro_v2.db).
// Cette passerelle sera supprimée lors de l'intégration IPC finale.

import { appDataDir, join } from '@tauri-apps/api/path';
import {
  SEED_STORE,
  SEED_ROLES,
  SEED_PERMISSIONS,
  SEED_USERS,
  SEED_CATEGORIES,
  SEED_BRANDS,
  SEED_SUPPLIERS,
  SEED_PRODUCTS,
  SEED_CUSTOMERS,
  SEED_BATCHES
} from './seed';

export interface QueryResult {
  rowsAffected: number;
  lastInsertId?: number;
}

class MemorySQLiteEngine {
  private tables: Record<string, any[]> = {};
  private initialized = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('aquadro_pos_v2_db');
        if (saved) {
          this.tables = JSON.parse(saved);
          this.initialized = true;
        }
      }
    } catch {
      // Ignorer si indisponible (environnement node/vitest)
    }
  }

  public saveToStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('aquadro_pos_v2_db', JSON.stringify(this.tables));
      }
    } catch {
      // Ignorer
    }
  }

  public initSeed() {
    if (this.initialized && Object.keys(this.tables).length > 0) return;

    this.tables['stores'] = [SEED_STORE];
    this.tables['roles'] = [...SEED_ROLES];
    this.tables['permissions'] = [...SEED_PERMISSIONS];
    this.tables['users'] = [...SEED_USERS];
    this.tables['categories'] = [...SEED_CATEGORIES];
    this.tables['brands'] = [...SEED_BRANDS];
    this.tables['suppliers'] = [...SEED_SUPPLIERS];
    this.tables['products'] = [...SEED_PRODUCTS];
    this.tables['customers'] = [...SEED_CUSTOMERS];
    this.tables['product_batches'] = [...SEED_BATCHES];
    this.tables['inventory_movements'] = [];
    this.tables['sales'] = [];
    this.tables['sale_items'] = [];
    this.tables['payments'] = [];
    this.tables['refunds'] = [];
    this.tables['refund_items'] = [];
    this.tables['purchases'] = [];
    this.tables['purchase_items'] = [];
    this.tables['expenses'] = [];
    this.tables['cash_sessions'] = [];
    this.tables['customer_payments'] = [];
    this.tables['supplier_payments'] = [];
    this.tables['commercial_documents'] = [];
    this.tables['document_sequences'] = [
      { document_type: 'TICKET', current_year: new Date().getFullYear(), last_sequence_number: 0 },
      { document_type: 'FACTURE', current_year: new Date().getFullYear(), last_sequence_number: 0 },
      { document_type: 'AVOIR', current_year: new Date().getFullYear(), last_sequence_number: 0 },
      { document_type: 'BON_LIVRAISON', current_year: new Date().getFullYear(), last_sequence_number: 0 },
      { document_type: 'COMMANDE', current_year: new Date().getFullYear(), last_sequence_number: 0 }
    ];
    this.tables['audit_logs'] = [];
    this.tables['sync_operations'] = [];

    this.initialized = true;
    this.saveToStorage();
  }

  public getTable(name: string): any[] {
    const key = name.toLowerCase();
    if (!this.tables[key]) {
      this.tables[key] = [];
    }
    return this.tables[key];
  }

  public resetTransactionsOnly() {
    const txTables = [
      'inventory_movements', 'sales', 'sale_items', 'payments', 'refunds', 'refund_items',
      'purchases', 'purchase_items', 'expenses', 'cash_sessions', 'customer_payments',
      'supplier_payments', 'commercial_documents', 'audit_logs', 'sync_operations'
    ];
    for (const t of txTables) {
      this.tables[t] = [];
    }
    if (this.tables['customers']) {
      for (const c of this.tables['customers']) c.current_debt = 0;
    }
    if (this.tables['suppliers']) {
      for (const s of this.tables['suppliers']) s.current_balance = 0;
    }
    this.saveToStorage();
  }

  public resetAll() {
    this.tables = {};
    this.initialized = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aquadro_setup_completed');
    }
    this.initSeed();
  }
}

const memoryDb = new MemorySQLiteEngine();

export class DatabaseService {
  private static instance: DatabaseService;
  private isTauri = false;
  private tauriDb: any = null;

  private constructor() {
    this.isTauri = typeof window !== 'undefined' && typeof (window as any).__TAURI_INTERNALS__?.invoke === 'function';
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isTauri) {
      try {
        const Database = (await import('@tauri-apps/plugin-sql')).default;
        // Transitional compatibility layer - targets the exact authoritative Rust AppData database
        const appData = await appDataDir();
        const dbPath = await join(appData, 'aquadro_v2.db');
        this.tauriDb = await Database.load(`sqlite:${dbPath}`);
        console.log(`Connecté à la base native SQLite Tauri : sqlite:${dbPath}`);
      } catch (err) {
        this.tauriDb = null;
        console.error('ERREUR CRITIQUE: Impossible de se connecter à la base de données native.', err);
        throw new Error(`Erreur critique d'initialisation de la base SQLite native: ${err}`);
      }
    } else {
      memoryDb.initSeed();
      console.log('Moteur Aquadro POS V2 SQLite initialisé (Mode Mémoire / LocalStorage)');
    }
  }

  public async execute(query: string, params: any[] = []): Promise<QueryResult> {
    if (this.isTauri) {
      if (!this.tauriDb) {
        throw new Error('Base de données native non initialisée. Échec de requête execute() pour empêcher tout repli silencieux vers le stockage mémoire.');
      }
      return await this.tauriDb.execute(query, params);
    }

    const trimmed = query.trim().toUpperCase();

    // 1. INSERT INTO table (col1, col2) VALUES (?, ?)
    if (trimmed.startsWith('INSERT INTO')) {
      const match = query.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
      if (match) {
        const table = match[1].toLowerCase();
        const colMatch = query.match(/\(([^)]+)\)\s*VALUES/i);
        if (colMatch) {
          const cols = colMatch[1].split(',').map(c => c.trim().toLowerCase());
          const record: Record<string, any> = {};
          cols.forEach((col, i) => {
            record[col] = params[i];
          });
          const rows = memoryDb.getTable(table);
          rows.push(record);
          memoryDb.saveToStorage();
          return { rowsAffected: 1 };
        }
      }
    }

    // 2. UPDATE table SET col1 = ?, col2 = ? WHERE id = ?
    if (trimmed.startsWith('UPDATE')) {
      const match = query.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/is);
      if (match) {
        const table = match[1].toLowerCase();
        const setClause = match[2];
        const whereClause = match[3] || '';
        const rows = memoryDb.getTable(table);
        let updatedCount = 0;

        const assignments = setClause.split(',').map(a => a.trim());
        let paramIdx = 0;
        const setAssignments: Array<{ col: string; val: any }> = [];

        for (const assign of assignments) {
          const parts = assign.split('=');
          const col = parts[0].trim().toLowerCase();
          const rhs = parts.slice(1).join('=').trim();
          if (rhs === '?') {
            setAssignments.push({ col, val: params[paramIdx++] });
          } else {
            const literalVal = rhs.replace(/^['"]|['"]$/g, '');
            const num = Number(literalVal);
            setAssignments.push({ col, val: isNaN(num) ? literalVal : num });
          }
        }

        const whereValues = params.slice(paramIdx);
        const whereParamMatches = [...whereClause.matchAll(/([a-zA-Z0-9_]+)\s*=\s*\?/g)];

        for (const row of rows) {
          let matches = true;
          if (whereParamMatches.length > 0) {
            for (let i = 0; i < whereParamMatches.length; i++) {
              const col = whereParamMatches[i][1].toLowerCase();
              if (row[col] != whereValues[i]) {
                matches = false;
                break;
              }
            }
          }

          if (matches) {
            for (const { col, val } of setAssignments) {
              row[col] = val;
            }
            updatedCount++;
          }
        }

        memoryDb.saveToStorage();
        return { rowsAffected: updatedCount };
      }
    }

    // 3. DELETE FROM table WHERE id = ?
    if (trimmed.startsWith('DELETE FROM')) {
      const match = query.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?/i);
      if (match) {
        const table = match[1].toLowerCase();
        const rows = memoryDb.getTable(table);
        const initialLen = rows.length;
        const targetId = params[0];

        const filtered = rows.filter(r => r.id !== targetId);
        const tableRef = memoryDb.getTable(table);
        tableRef.length = 0;
        tableRef.push(...filtered);

        memoryDb.saveToStorage();
        return { rowsAffected: initialLen - filtered.length };
      }
    }

    return { rowsAffected: 1 };
  }

  public async select<T = any>(query: string, params: any[] = []): Promise<T[]> {
    if (this.isTauri) {
      if (!this.tauriDb) {
        throw new Error('Base de données native non initialisée. Échec de requête select() pour empêcher tout repli silencieux vers le stockage mémoire.');
      }
      return await this.tauriDb.select(query, params);
    }

    const trimmed = query.trim().toUpperCase();
    const match = query.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    if (!match) return [];

    const table = match[1].toLowerCase();
    let rows = [...memoryDb.getTable(table)];

    // Filtre WHERE
    if (trimmed.includes('WHERE')) {
      const wherePart = query.substring(query.toUpperCase().indexOf('WHERE') + 5).split(/ORDER BY|LIMIT/i)[0];

      // 1. Colonnes avec paramètres positionnels: col = ?
      const paramMatches = [...wherePart.matchAll(/([a-zA-Z0-9_]+)\s*=\s*\?/g)];
      if (paramMatches.length > 0 && params.length >= paramMatches.length) {
        paramMatches.forEach((m, idx) => {
          const col = m[1].toLowerCase();
          const val = params[idx];
          rows = rows.filter(r => r[col] == val);
        });
      }

      // 2. Littéraux chaîne: status = 'OPEN'
      const literalMatches = [...wherePart.matchAll(/([a-zA-Z0-9_]+)\s*=\s*'([^']+)'/g)];
      for (const m of literalMatches) {
        const col = m[1].toLowerCase();
        const val = m[2];
        rows = rows.filter(r => r[col] === val);
      }

      // 3. Clause IN: role IN ('manager', 'owner', 'admin')
      const inMatches = [...wherePart.matchAll(/([a-zA-Z0-9_]+)\s+IN\s*\(([^)]+)\)/gi)];
      for (const m of inMatches) {
        const col = m[1].toLowerCase();
        const values = m[2].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
        rows = rows.filter(r => values.includes(r[col]));
      }

      // 4. Littéral numérique: is_active = 1
      if (/is_active\s*=\s*1/i.test(wherePart)) {
        rows = rows.filter(r => r.is_active === 1 || r.is_active === true);
      }

      // 5. Comparateur stock: current_stock > 0
      if (/current_stock\s*>\s*0/i.test(wherePart)) {
        rows = rows.filter(r => (r.current_stock || 0) > 0);
      }
    }

    // Tri ORDER BY
    if (trimmed.includes('ORDER BY EXPIRATION_DATE ASC')) {
      rows.sort((a, b) => (a.expiration_date || '').localeCompare(b.expiration_date || ''));
    } else if (trimmed.includes('ORDER BY CREATED_AT DESC') || trimmed.includes('ORDER BY OPENED_AT DESC')) {
      rows.sort((a, b) => (b.created_at || b.opened_at || '').localeCompare(a.created_at || a.opened_at || ''));
    } else if (trimmed.includes('ORDER BY NAME ASC') || trimmed.includes('ORDER BY NAME_FR ASC')) {
      rows.sort((a, b) => (a.name || a.name_fr || '').localeCompare(b.name || b.name_fr || ''));
    }

    // Limite LIMIT
    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1], 10);
      rows = rows.slice(0, limit);
    }

    return rows as T[];
  }

  public async resetTransactionsOnly(): Promise<void> {
    if (this.isTauri) {
      if (!this.tauriDb) {
        throw new Error('Base de données native non initialisée.');
      }
      const txTables = [
        'inventory_movements', 'refund_items', 'refunds', 'payments', 'sale_items',
        'sales', 'purchase_items', 'purchases', 'expenses', 'cash_sessions',
        'customer_payments', 'supplier_payments', 'commercial_documents',
        'audit_logs', 'sync_operations'
      ];
      for (const t of txTables) {
        await this.tauriDb.execute(`DELETE FROM ${t}`);
      }
      await this.tauriDb.execute('UPDATE customers SET current_debt = 0');
      await this.tauriDb.execute('UPDATE suppliers SET current_balance = 0');
    } else {
      memoryDb.resetTransactionsOnly();
    }
  }

  public async resetAll(): Promise<void> {
    if (this.isTauri) {
      if (!this.tauriDb) {
        throw new Error('Base de données native non initialisée.');
      }
      const allTables = [
        'inventory_movements', 'refund_items', 'refunds', 'payments', 'sale_items',
        'sales', 'purchase_items', 'purchases', 'expenses', 'cash_sessions',
        'customer_payments', 'supplier_payments', 'commercial_documents',
        'audit_logs', 'sync_operations', 'product_batches', 'products',
        'categories', 'brands', 'suppliers', 'customers'
      ];
      for (const t of allTables) {
        await this.tauriDb.execute(`DELETE FROM ${t}`);
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aquadro_setup_completed');
      }
    } else {
      memoryDb.resetAll();
    }
  }

  public getRawStore() {
    return memoryDb;
  }
}

export const db = DatabaseService.getInstance();
