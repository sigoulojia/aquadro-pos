// Aquadro POS Algérie V2 — Définition des Types de Données (TypeScript Interfaces)
// Conforme au schéma SQLite local et à la réplication Supabase

export type UserRole = 'owner' | 'manager' | 'cashier';

export interface User {
  id: string;
  store_id?: string;
  name: string;
  role: UserRole;
  pin_hash: string; // Format salt:hashHex
  phone?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export type FiscalRegime = 'IFU' | 'REEL';
export type FiscalProfile = 'IFU' | 'REEL';

export interface Store {
  id: string;
  name?: string;
  name_fr: string;
  name_ar: string;
  wilaya: string;
  commune: string;
  address: string;
  phone: string;
  email?: string;
  rc_number: string;      // Registre de Commerce
  nif_number: string;     // Numéro d'Identification Fiscale
  nis_number: string;     // Numéro d'Identification Statistique
  ai_number: string;      // Article d'Imposition
  activity?: string;
  fiscal_regime: FiscalRegime;
  fiscal_profile?: FiscalProfile;
  default_tva_rate: number; // 0.0, 0.09, 0.19
  receipt_header?: string;
  receipt_footer?: string;
  currency: string;       // 'DZD' (دج)
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name?: string;
  name_fr: string;
  name_ar: string;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
  created_at: string;
}

export type UnitOfMeasure = 'UNIT' | 'BOX' | 'CARTON' | 'PACK';

export interface ProductBatch {
  id: string;
  product_id: string;
  batch_number: string;
  expiration_date: string; // YYYY-MM-DD
  current_stock: number;
  purchase_cost: number;
  created_at: string;
}

export interface Product {
  id: string;
  store_id?: string;
  category_id?: string;
  category_name?: string;
  brand_id?: string;
  brand_name?: string;
  sku: string;
  barcode: string;
  additional_barcodes?: string[];
  name?: string;
  name_fr: string;
  name_ar: string;
  variant?: string;
  size_weight?: string;
  unit_of_measure: UnitOfMeasure;
  box_conversion_ratio: number;
  purchase_cost: number;        // Coût d'achat de référence en DZD
  purchase_price?: number;
  selling_price_ttc: number;    // Prix public TTC en DZD
  selling_price?: number;
  discount_price?: number | null;
  min_selling_price_ttc: number;// Seuil plancher TTC en DZD
  tva_rate: number;             // 0.19, 0.09 ou 0.00
  current_stock: number;
  min_stock_alert: number;
  min_stock_threshold?: number;
  batch_number?: string;
  expiration_date?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  batches?: ProductBatch[];     // Lots FEFO rattachés
}

export type MovementType = 'PURCHASE' | 'SALE' | 'RETURN' | 'DAMAGE' | 'EXPIRY' | 'ADJUSTMENT';

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name?: string;
  batch_id?: string;
  movement_type: MovementType;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reference_id?: string;
  reason: string;
  unit_cost_snapshot?: number;
  user_id: string;
  user_name?: string;
  created_at: string;
}

export type SessionStatus = 'OPEN' | 'CLOSED';

export interface CashSession {
  id: string;
  cashier_id: string;
  cashier_name: string;
  opened_at: string;
  closed_at?: string;
  status: SessionStatus;
  opening_float: number;
  total_cash_sales: number;
  total_card_sales: number;
  total_qr_sales: number;
  total_credit_sales: number;
  total_cash_refunds: number;
  total_cash_expenses: number;
  expected_cash_drawer: number;
  actual_counted_cash?: number;
  cash_discrepancy?: number;
  closing_notes?: string;
  closed_by_manager_name?: string;
}

export type SaleStatus = 'COMPLETED' | 'HELD' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  sku?: string;
  batch_id?: string;
  batch_number?: string;
  quantity: number;
  unit_price_ttc: number;
  unit_price?: number;
  discount_amount: number;
  total_ttc: number;
  total_price?: number;
  unit_purchase_cost_snapshot: number; // Snapshot figé au moment de la vente
  unit_purchase_price?: number;
  created_at: string;
}

export type PaymentMethod = 'CASH' | 'CIB' | 'EDAHABIA' | 'BARIDIMOB' | 'CREDIT';

export interface Payment {
  id: string;
  sale_id: string;
  payment_method: PaymentMethod;
  amount: number;
  tendered_amount: number;
  change_given: number;
  tpe_auth_reference?: string;
  created_at: string;
}

export interface Sale {
  id: string;
  receipt_number: string; // TKT-YYYY-NNNNNN
  session_id?: string;
  cashier_id: string;
  cashier_name?: string;
  customer_id?: string;
  customer_name?: string;
  subtotal_ht: number;
  subtotal?: number;
  discount_amount: number;
  tax_amount: number;
  total_ttc: number;
  total_amount?: number;
  status: SaleStatus;
  idempotency_key: string;
  sync_status: 'PENDING' | 'SYNCED' | 'FAILED';
  created_at: string;
  items?: SaleItem[];
  payments?: Payment[];
}

export interface RefundItem {
  id: string;
  refund_id: string;
  sale_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  refund_price: number;
  unit_purchase_price: number;
  restock_inventory: number;
}

export interface Refund {
  id: string;
  original_sale_id: string;
  receipt_number: string;
  cashier_id: string;
  cashier_name?: string;
  refund_amount: number;
  payment_method: PaymentMethod;
  reason: string;
  authorized_by_pin?: string;
  created_at: string;
  items?: RefundItem[];
}

export type ExpenseCategory =
  | 'RENT'
  | 'ELECTRICITY'
  | 'WATER'
  | 'INTERNET'
  | 'PACKAGING'
  | 'TRANSPORT'
  | 'MAINTENANCE'
  | 'CLEANING'
  | 'SUPPLIES'
  | 'OTHER';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  payment_method: 'CASH' | 'BANK';
  description: string;
  date: string; // YYYY-MM-DD
  user_id: string;
  user_name?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  wilaya?: string;
  notes?: string;
  credit_limit: number;
  current_debt: number;
  loyalty_points: number;
  created_at: string;
}

export interface CustomerPayment {
  id: string;
  customer_id: string;
  customer_name?: string;
  amount: number;
  payment_method: PaymentMethod;
  reference?: string;
  cashier_id: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  rc_number?: string;
  nif_number?: string;
  current_balance: number; // Solde dû au fournisseur
  created_at: string;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  amount: number;
  payment_method: 'CASH' | 'CHECK' | 'TRANSFER';
  reference?: string;
  cashier_id: string;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  quantity_ordered: number;
  quantity_received: number;
  purchase_cost: number;
  batch_number?: string;
  expiration_date?: string;
}

export interface Purchase {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  order_number: string;
  total_cost: number;
  status: 'ORDERED' | 'RECEIVED';
  ordered_at: string;
  received_at?: string;
  items?: PurchaseItem[];
}

export type DocumentType = 'TICKET' | 'FACTURE' | 'AVOIR' | 'BON_LIVRAISON' | 'COMMANDE';

export interface DocumentRecord {
  id: string;
  document_type: DocumentType;
  document_number: string;
  reference_id: string;
  customer_or_supplier_name?: string;
  total_ttc: number;
  created_at: string;
}

export interface StocktakeItem {
  id: string;
  stocktake_id: string;
  product_id: string;
  product_name: string;
  batch_id?: string;
  batch_number?: string;
  expected_qty: number;
  counted_qty: number;
  difference_qty: number;
  value_difference: number;
}

export interface Stocktake {
  id: string;
  date: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  notes?: string;
  authorized_by?: string;
  created_at: string;
  items?: StocktakeItem[];
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  created_at: string;
}

export interface SyncOperation {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  retry_count: number;
  last_error?: string;
  created_at: string;
  synced_at?: string;
}
