-- ============================================================================
-- Aquadro POS Algérie V2 — Schéma DDL SQLite Local (Architecture Pro Commerce)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Configuration de l'Établissement & Régime Fiscal DGI
CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name_fr TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    wilaya TEXT NOT NULL,
    commune TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    rc_number TEXT NOT NULL,
    nif_number TEXT NOT NULL,
    nis_number TEXT NOT NULL,
    ai_number TEXT NOT NULL,
    fiscal_regime TEXT NOT NULL DEFAULT 'IFU', -- 'IFU' ou 'REEL'
    default_tva_rate REAL DEFAULT 0.0,
    receipt_header TEXT,
    receipt_footer TEXT,
    currency TEXT DEFAULT 'DZD',
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. Utilisateurs & Sécurité (Codes PIN avec sel aléatoire)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id),
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- 'owner', 'admin', 'manager', 'cashier'
    pin_hash TEXT NOT NULL, -- Format salt:hashHex
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 3. Catégories & Marques
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name_fr TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- 4. Produits (Articles de nutrition sportive)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id),
    category_id TEXT REFERENCES categories(id),
    brand_id TEXT REFERENCES brands(id),
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE NOT NULL,
    additional_barcodes TEXT,
    name_fr TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    variant TEXT,
    size_weight TEXT,
    unit_of_measure TEXT DEFAULT 'UNIT',
    box_conversion_ratio REAL DEFAULT 1.0,
    purchase_cost INTEGER NOT NULL DEFAULT 0,
    selling_price_ttc INTEGER NOT NULL DEFAULT 0,
    min_selling_price_ttc INTEGER NOT NULL DEFAULT 0,
    tva_rate REAL DEFAULT 0.0,
    current_stock REAL NOT NULL DEFAULT 0.0,
    min_stock_alert REAL NOT NULL DEFAULT 5.0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prod_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_prod_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_prod_cat ON products(category_id);

-- 5. Lots de Produits & Traçabilité FEFO
CREATE TABLE IF NOT EXISTS product_batches (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    expiration_date TEXT NOT NULL, -- YYYY-MM-DD
    current_stock REAL NOT NULL DEFAULT 0.0,
    purchase_cost INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_batch_fefo ON product_batches(product_id, expiration_date ASC);

-- 6. Mouvements de Stock
CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    batch_id TEXT REFERENCES product_batches(id),
    movement_type TEXT NOT NULL,
    quantity_change REAL NOT NULL,
    previous_stock REAL NOT NULL,
    new_stock REAL NOT NULL,
    reference_id TEXT,
    reason TEXT NOT NULL,
    unit_cost_snapshot INTEGER,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inv_movement_product ON inventory_movements(product_id, created_at DESC);

-- 7. Sessions de Caisse (Gestion de Caisse)
CREATE TABLE IF NOT EXISTS cash_sessions (
    id TEXT PRIMARY KEY,
    cashier_id TEXT NOT NULL REFERENCES users(id),
    cashier_name TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',
    opening_float INTEGER NOT NULL DEFAULT 0,
    total_cash_sales INTEGER NOT NULL DEFAULT 0,
    total_card_sales INTEGER NOT NULL DEFAULT 0,
    total_qr_sales INTEGER NOT NULL DEFAULT 0,
    total_credit_sales INTEGER NOT NULL DEFAULT 0,
    total_cash_refunds INTEGER NOT NULL DEFAULT 0,
    total_cash_expenses INTEGER NOT NULL DEFAULT 0,
    expected_cash_drawer INTEGER NOT NULL DEFAULT 0,
    actual_counted_cash INTEGER,
    cash_discrepancy INTEGER,
    closing_notes TEXT,
    closed_by_manager_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status, opened_at DESC);

-- 8. Ventes & Lignes de Vente (Snapshot Coût Historique)
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    receipt_number TEXT UNIQUE NOT NULL,
    session_id TEXT REFERENCES cash_sessions(id),
    cashier_id TEXT NOT NULL REFERENCES users(id),
    customer_id TEXT,
    subtotal_ht INTEGER NOT NULL,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    total_ttc INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    idempotency_key TEXT UNIQUE NOT NULL,
    sync_status TEXT DEFAULT 'PENDING',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_number);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);

CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    batch_id TEXT REFERENCES product_batches(id),
    quantity REAL NOT NULL,
    unit_price_ttc INTEGER NOT NULL,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    total_ttc INTEGER NOT NULL,
    unit_purchase_cost_snapshot INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- 9. Règlements
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL,
    amount INTEGER NOT NULL,
    tendered_amount INTEGER NOT NULL,
    change_given INTEGER NOT NULL DEFAULT 0,
    tpe_auth_reference TEXT,
    created_at TEXT NOT NULL
);

-- 10. Remboursements
CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    original_sale_id TEXT NOT NULL REFERENCES sales(id),
    receipt_number TEXT UNIQUE NOT NULL,
    cashier_id TEXT NOT NULL REFERENCES users(id),
    refund_amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    reason TEXT NOT NULL,
    authorized_by_pin TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refund_items (
    id TEXT PRIMARY KEY,
    refund_id TEXT NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
    sale_item_id TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    refund_price INTEGER NOT NULL,
    unit_purchase_price INTEGER NOT NULL,
    restock_inventory INTEGER DEFAULT 1
);

-- 11. Dépenses du Magasin
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    description TEXT NOT NULL,
    date TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);

-- 12. Clients & Crédits Clients
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    wilaya TEXT,
    notes TEXT,
    credit_limit INTEGER DEFAULT 0,
    current_debt INTEGER DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_payments (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    reference TEXT,
    cashier_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);

-- 13. Fournisseurs & Achats
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    rc_number TEXT,
    nif_number TEXT,
    current_balance INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id),
    order_number TEXT UNIQUE NOT NULL,
    total_cost INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'ORDERED',
    ordered_at TEXT NOT NULL,
    received_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY,
    purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity_ordered REAL NOT NULL,
    quantity_received REAL DEFAULT 0.0,
    purchase_cost INTEGER NOT NULL,
    batch_number TEXT,
    expiration_date TEXT
);

-- 14. Documents Commerciaux & Séquences Inviolables
CREATE TABLE IF NOT EXISTS document_sequences (
    document_type TEXT PRIMARY KEY,
    current_year INTEGER NOT NULL,
    last_sequence_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS commercial_documents (
    id TEXT PRIMARY KEY,
    document_type TEXT NOT NULL,
    document_number TEXT UNIQUE NOT NULL,
    reference_id TEXT NOT NULL,
    customer_or_supplier_name TEXT,
    total_ttc INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

-- 15. Journal d'Audit & File d'Attente Outbox
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS sync_operations (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    synced_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_op ON sync_operations(status, created_at);
