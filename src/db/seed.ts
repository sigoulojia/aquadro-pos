// Aquadro POS Algérie V2 — Clean Seed Data
// Base de données vierge prête pour la production

export const SEED_STORE = {
  id: 'store-001',
  name: 'Mon Magasin',
  code: 'MAG-01',
  address: 'Adresse du magasin',
  phone: '0000 00 00 00',
  email: 'contact@magasin.dz',
  tax_number: 'NIF: 000000000000000 - RC: 00/00-0000000',
  receipt_header: 'MON MAGASIN\nBienvenue',
  receipt_footer: 'Merci de votre visite !',
  currency: 'DZD',
  tax_rate: 0.0, 
  is_active: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export const SEED_ROLES = [
  { id: 'role-owner', name: 'owner', description: 'Propriétaire du magasin (accès total)', created_at: new Date().toISOString() },
  { id: 'role-admin', name: 'admin', description: 'Administrateur système et catalogue', created_at: new Date().toISOString() },
  { id: 'role-manager', name: 'manager', description: 'Responsable de magasin (remises, retours, clôture)', created_at: new Date().toISOString() },
  { id: 'role-cashier', name: 'cashier', description: 'Caissier (encaissement, scan codes-barres)', created_at: new Date().toISOString() }
];

export const SEED_PERMISSIONS = [
  { id: 'p1', code: 'pos.checkout', description: 'Encaissement des ventes et règlement', category: 'POS' },
  { id: 'p2', code: 'pos.hold_resume', description: 'Mise en attente et reprise de panier', category: 'POS' },
  { id: 'p3', code: 'pos.apply_discount', description: 'Application de remises exceptionnelles', category: 'POS' },
  { id: 'p4', code: 'pos.void_sale', description: 'Annulation d\'une vente en cours', category: 'POS' },
  { id: 'p5', code: 'sales.view', description: 'Consultation de l\'historique des ventes', category: 'Sales' },
  { id: 'p6', code: 'sales.refund', description: 'Traitement des remboursements et retours', category: 'Sales' },
  { id: 'p7', code: 'inventory.view', description: 'Consultation des stocks', category: 'Inventory' },
  { id: 'p8', code: 'inventory.adjust', description: 'Ajustement de stock (avarié, périmé, inventaire)', category: 'Inventory' },
  { id: 'p9', code: 'products.view_cost', description: 'Consultation des prix d\'achat et marges', category: 'Products' },
  { id: 'p10', code: 'products.manage', description: 'Gestion du catalogue produits', category: 'Products' },
  { id: 'p11', code: 'purchases.manage', description: 'Bons de commande et réception fournisseurs', category: 'Purchases' },
  { id: 'p12', code: 'reports.view', description: 'Rapports financiers, marges et clôture Z', category: 'Reports' },
  { id: 'p13', code: 'users.manage', description: 'Gestion des employés et des codes PIN', category: 'Users' },
  { id: 'p14', code: 'settings.manage', description: 'Configuration imprimante ticket et TVA', category: 'Settings' },
  { id: 'p15', code: 'ai.assistant', description: 'Utilisation du copilote IA', category: 'AI' }
];

// Un seul compte Admin par défaut
export const SEED_USERS = [
  {
    id: 'user-001',
    store_id: 'store-001',
    role_id: 'role-owner',
    role: 'owner' as const,
    name: 'Admin',
    email: 'admin@magasin.dz',
    // Default PIN: 1234
    pin_hash: 'a1b2c3d4e5f60718:8f258a12e34567890abcdef1234567890abcdef1234567890abcdef123456789',
    phone: '0000000000',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'user-002',
    store_id: 'store-001',
    role_id: 'role-manager',
    role: 'manager' as const,
    name: 'Yacine Amrani',
    email: 'yacine@magasin.dz',
    pin_hash: 'a1b2c3d4e5f60718:8f258a12e34567890abcdef1234567890abcdef1234567890abcdef123456789',
    phone: '0550000002',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'user-003',
    store_id: 'store-001',
    role_id: 'role-cashier',
    role: 'cashier' as const,
    name: 'Sarah Connor',
    email: 'sarah@magasin.dz',
    pin_hash: 'a1b2c3d4e5f60718:8f258a12e34567890abcdef1234567890abcdef1234567890abcdef123456789',
    phone: '0550000003',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const SEED_CATEGORIES = [
  { id: 'cat-001', name_fr: 'Protéines', name_ar: 'بروتينات', created_at: new Date().toISOString() },
  { id: 'cat-002', name_fr: 'Créatines', name_ar: 'كرياتين', created_at: new Date().toISOString() },
  { id: 'cat-003', name_fr: 'Acides Aminés', name_ar: 'أحماض أمينية', created_at: new Date().toISOString() }
];

export const SEED_BRANDS = [
  { id: 'brand-001', name: 'Optimum Nutrition', created_at: new Date().toISOString() },
  { id: 'brand-002', name: 'Dymatize', created_at: new Date().toISOString() }
];

export const SEED_SUPPLIERS = [
  {
    id: 'sup-001',
    name: 'Distributeur Sport Algérie',
    phone: '023000000',
    email: 'contact@sports-dz.com',
    address: 'Alger, Algérie',
    current_balance: 0,
    created_at: new Date().toISOString()
  }
];

export const SEED_PRODUCTS = [
  {
    id: 'prod-001',
    store_id: 'store-001',
    category_id: 'cat-001',
    brand_id: 'brand-001',
    name: 'Optimum Nutrition Gold Standard Whey 2.27kg',
    name_fr: 'Optimum Nutrition Gold Standard Whey 2.27kg',
    name_ar: 'أوبتيموم نوتريشن واي بروتين 2.27 كغ',
    sku: 'ON-WHEY-2KG',
    barcode: '748927028669',
    purchase_cost: 13000,
    purchase_price: 13000,
    selling_price_ttc: 16800,
    selling_price: 16800,
    current_stock: 35,
    min_stock_alert: 5,
    min_stock_threshold: 5,
    unit_of_measure: 'UNIT',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'prod-002',
    store_id: 'store-001',
    category_id: 'cat-002',
    brand_id: 'brand-001',
    name: 'Creatine Monohydrate 300g',
    name_fr: 'Creatine Monohydrate 300g',
    name_ar: 'كرياتين مونوهيدرات 300 غ',
    sku: 'ON-CREATINE-300G',
    barcode: '748927028670',
    purchase_cost: 3200,
    purchase_price: 3200,
    selling_price_ttc: 4500,
    selling_price: 4500,
    current_stock: 20,
    min_stock_alert: 5,
    min_stock_threshold: 5,
    unit_of_measure: 'UNIT',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'prod-003',
    store_id: 'store-001',
    category_id: 'cat-003',
    brand_id: 'brand-001',
    name: 'BCAA Energy 280g',
    name_fr: 'BCAA Energy 280g',
    name_ar: 'بي سي إيه إيه إنرجي 280 غ',
    sku: 'BCAA-280G',
    barcode: '748927028671',
    purchase_cost: 3800,
    purchase_price: 3800,
    selling_price_ttc: 5200,
    selling_price: 5200,
    current_stock: 15,
    min_stock_alert: 5,
    min_stock_threshold: 5,
    unit_of_measure: 'UNIT',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const SEED_CUSTOMERS = [
  {
    id: 'cust-001',
    store_id: 'store-001',
    name: 'Mohamed Benali',
    phone: '0550123456',
    email: 'mohamed@example.dz',
    loyalty_points: 150,
    total_spent: 45000,
    current_debt: 0,
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const SEED_BATCHES = [
  {
    id: 'batch-001',
    product_id: 'prod-001',
    batch_number: 'LOT-2026-EARLY',
    expiration_date: '2027-01-15',
    current_stock: 10,
    purchase_cost: 13000,
    purchase_price: 13000,
    created_at: new Date().toISOString()
  },
  {
    id: 'batch-002',
    product_id: 'prod-001',
    batch_number: 'LOT-2026-LATE',
    expiration_date: '2027-08-30',
    current_stock: 25,
    purchase_cost: 13500,
    purchase_price: 13500,
    created_at: new Date().toISOString()
  },
  {
    id: 'batch-003',
    product_id: 'prod-002',
    batch_number: 'LOT-2026-CREA',
    expiration_date: '2027-12-31',
    current_stock: 20,
    purchase_cost: 3200,
    purchase_price: 3200,
    created_at: new Date().toISOString()
  },
  {
    id: 'batch-004',
    product_id: 'prod-003',
    batch_number: 'LOT-2026-BCAA',
    expiration_date: '2027-10-31',
    current_stock: 15,
    purchase_cost: 3800,
    purchase_price: 3800,
    created_at: new Date().toISOString()
  }
];
