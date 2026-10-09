-- ============================================================================
-- Aquadro POS - Supabase PostgreSQL Schema & Security Policies (Algeria Retail)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stores
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    tax_number TEXT, -- NIF / RC / Art. Imposition
    receipt_header TEXT,
    receipt_footer TEXT,
    currency TEXT DEFAULT 'DZD',
    tax_rate NUMERIC(5, 4) DEFAULT 0.0000, -- Configurable TVA rate
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles & Permissions
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Users (Salted hashes, zero plaintext)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES public.stores(id),
    role_id UUID NOT NULL REFERENCES public.roles(id),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    pin_hash TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories & Brands
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES public.categories(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    website TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    tax_id TEXT,
    payment_terms TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products (DZD pricing)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES public.stores(id),
    category_id UUID REFERENCES public.categories(id),
    brand_id UUID REFERENCES public.brands(id),
    supplier_id UUID REFERENCES public.suppliers(id),
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE NOT NULL,
    description TEXT,
    variant TEXT,
    size_weight TEXT,
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_price NUMERIC(12, 2),
    current_stock NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    min_stock_threshold NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    batch_number TEXT,
    expiration_date DATE,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cloud_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_cloud_products_sku ON public.products(sku);

-- Product Batches (FEFO: First Expired, First Out)
CREATE TABLE IF NOT EXISTS public.product_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    current_stock NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cloud_batch_fefo ON public.product_batches(product_id, expiration_date ASC);

-- Inventory Movements
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id),
    store_id UUID REFERENCES public.stores(id),
    user_id UUID NOT NULL REFERENCES public.users(id),
    movement_type TEXT NOT NULL,
    quantity_change NUMERIC(10, 2) NOT NULL,
    previous_stock NUMERIC(10, 2) NOT NULL,
    new_stock NUMERIC(10, 2) NOT NULL,
    reference_id UUID,
    reason TEXT NOT NULL,
    batch_number TEXT,
    unit_cost_snapshot NUMERIC(12, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES public.stores(id),
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    email TEXT,
    notes TEXT,
    loyalty_points INTEGER DEFAULT 0,
    total_spent NUMERIC(12, 2) DEFAULT 0.00,
    purchase_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cash Sessions (Fonds de caisse / Daily closing)
CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cashier_id UUID NOT NULL REFERENCES public.users(id),
    store_id UUID REFERENCES public.stores(id),
    status TEXT NOT NULL DEFAULT 'OPEN',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_float NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cash_refunds NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cash_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    expected_cash_drawer NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    actual_counted_cash NUMERIC(12, 2),
    cash_discrepancy NUMERIC(12, 2),
    notes TEXT,
    closed_by_manager_name TEXT
);

-- Sales
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number TEXT UNIQUE NOT NULL,
    store_id UUID REFERENCES public.stores(id),
    cashier_id UUID NOT NULL REFERENCES public.users(id),
    customer_id UUID REFERENCES public.customers(id),
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    subtotal NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    notes TEXT,
    idempotency_key UUID UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sale Items (Immutable historical cost snapshot)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity NUMERIC(10, 2) NOT NULL,
    unit_purchase_price NUMERIC(12, 2) NOT NULL, -- Preserves historical cost basis at time of sale
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12, 2) NOT NULL,
    batch_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    tendered_amount NUMERIC(12, 2) NOT NULL,
    change_given NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    card_brand TEXT,
    card_last_four TEXT,
    transaction_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_data JSONB,
    new_data JSONB,
    reason TEXT,
    ip_or_terminal TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Row Level Security (RLS) Configuration
-- ============================================================================

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store staff can view products" ON public.products
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Store staff can view batches" ON public.product_batches
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Cashiers can insert sales" ON public.sales
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Cashiers can insert sale items" ON public.sale_items
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Cashiers can insert payments" ON public.payments
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Audit logs insert only" ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- Cash Sessions (Gestion de Caisse / Rapport Z)
CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cashier_id UUID NOT NULL REFERENCES public.users(id),
    cashier_name TEXT,
    store_id UUID REFERENCES public.stores(id),
    status TEXT NOT NULL DEFAULT 'OPEN',
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    opening_float NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_cash_sales NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_cash_refunds NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_cash_expenses NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    expected_cash_drawer NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    actual_counted_cash NUMERIC(14, 2),
    cash_discrepancy NUMERIC(14, 2),
    notes TEXT,
    closed_by_manager_name TEXT
);
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cash sessions viewable by authenticated users" ON public.cash_sessions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cash sessions insertable/updatable by staff" ON public.cash_sessions
    FOR ALL TO authenticated USING (true);

