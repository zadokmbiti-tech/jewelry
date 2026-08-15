CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    sale_price NUMERIC(10, 2),
    category TEXT NOT NULL CHECK (category IN (
        'xuping-earrings',
        'genuine-leather-belts',
        'kids-xuping-earrings',
        'xuping-necklaces',
        'pearl-necklaces',
        'pu-leather-belts',
        'male-stainless-steel-sets',
        'statement-stainless-earrings',
        'fashion-jewelry-necklace-sets',
        'hypoallergenic-watches',
        'genuine-leather-watches',
        'elite-compact-jewelry-case',
        'charger-protectors',
        'brass-jewelry',
        'hair-clips',
        'twist-fabric-headband',
        'pearl-twist-headband',
        'magnetic-and-generic-watches',
        'kids-pocket-mirrors',
        'adult-pocket-mirrors',
        'anxiety-rings',
        'brass-rings',
        'stainless-steel-rings',
        'xuping-rings',
        'classic-jewelry-organizers',
        'statement-rings',
        'kids-digital-watches',
        'sunglasses',
        'photochromic-glasses',
        'premium-wine-bottle-gift-box',
        'anti-blue-light-glasses',
        'ruched-rhinestone-headband',
        'pearl-and-rhinestones-headband',
        'crystal-satin-ruche-headband',
        'travel-bags',
        'stainless-steel-necklaces',
        'mens-watches',
        'tennis-bracelets',
        'xuping-bangles',
        'xuping-tennis-bracelets',
        'xuping-bracelets',
        'brass-necklaces'
    )),
    quantity INTEGER NOT NULL DEFAULT 0,
    is_new BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sale_price_below_price CHECK (sale_price IS NULL OR sale_price < price)
);

-- Existing databases: run this once against your Neon DB to add the column
-- without dropping/recreating the table.
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10, 2);
-- ALTER TABLE products ADD CONSTRAINT sale_price_below_price CHECK (sale_price IS NULL OR sale_price < price);

CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    blob_url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    -- 'video' lets a product carry short demo clips alongside its photos in
    -- the same gallery/table, instead of a separate table -- the storefront
    -- and admin panel both key off this to decide <img> vs <video>.
    media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

-- Referenced by /customers and /admin/customers in main.py but was missing
-- from this file -- added so a fresh database actually has the table.
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders placed via "Checkout with M-Pesa". Payment isn't wired to the real
-- Daraja API yet -- status starts 'pending' and admin marks it 'paid' (or
-- 'cancelled') manually from the admin panel until STK push is integrated.
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ─────────────────────────────────────────────────────────────────────────
-- MIGRATION: run this instead of the CREATE TABLE above if you already have
-- a live database from before (it drops the old materials column and adds
-- quantity in its place, keeping your existing product rows intact).
-- ─────────────────────────────────────────────────────────────────────────
-- ALTER TABLE products DROP COLUMN IF EXISTS materials;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────
-- MIGRATION: adds video-demo support to an existing product_images table
-- (safe to re-run -- IF NOT EXISTS guards it). Existing rows default to
-- 'image', which is what they already are.
-- ─────────────────────────────────────────────────────────────────────────
-- ALTER TABLE product_images ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video'));