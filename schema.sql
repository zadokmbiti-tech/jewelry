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
        'brass-necklaces',
        'bag-charms',
        'other_items'
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
-- phone is UNIQUE because it's now the login identifier for real customer
-- accounts (see password_hash below) -- one account per phone number.
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Login sessions issued by POST /auth/login and /auth/register. A customer
-- sends the token back as X-Customer-Token on every authenticated request
-- (placing an order, viewing "My Orders"). Sessions expire after 30 days.
CREATE TABLE IF NOT EXISTS customer_sessions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON customer_sessions(token);

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

-- Star ratings + comments left on products. Tied to a logged-in customer
-- account (reviews require an account, same as checkout) so one customer
-- can't post unlimited anonymous reviews.
CREATE TABLE IF NOT EXISTS product_reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One review per customer per product -- editing a review is a future
    -- feature, but duplicate reviews from the same account are blocked now.
    UNIQUE (product_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);

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

-- ─────────────────────────────────────────────────────────────────────────
-- MIGRATION: turns the old "lead capture" customers table into real
-- accounts (password_hash + a UNIQUE phone). Run this against your existing
-- Neon database -- a fresh UNIQUE constraint will fail outright if you
-- already have duplicate phone numbers on file, so this checks for those
-- first and keeps only the newest row per phone before adding the
-- constraint.
-- ─────────────────────────────────────────────────────────────────────────
-- ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
--
-- -- 1. Inspect duplicates first (run this alone and review the output):
-- -- SELECT phone, COUNT(*) FROM customers GROUP BY phone HAVING COUNT(*) > 1;
--
-- -- 2. If duplicates exist, keep only the most recent row per phone.
-- --    Orders already reference customer_id, so this reassigns their
-- --    older/duplicate customer_id to the row being kept before deleting.
-- DELETE FROM customers a USING customers b
--   WHERE a.phone = b.phone AND a.created_at < b.created_at;
--
-- -- 3. Now the UNIQUE constraint can be added safely.
-- ALTER TABLE customers ADD CONSTRAINT customers_phone_key UNIQUE (phone);
--
-- CREATE TABLE IF NOT EXISTS customer_sessions (
--     id SERIAL PRIMARY KEY,
--     customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
--     token TEXT NOT NULL UNIQUE,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--     expires_at TIMESTAMPTZ NOT NULL
-- );
-- CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON customer_sessions(token);
--
-- -- Existing rows from the old lead-capture flow have password_hash = NULL.
-- -- They stay in the table (so old orders keep their customer_id link) but
-- -- can't log in until that phone number registers a real password via
-- -- POST /auth/register, which claims the existing row instead of erroring.

-- ─────────────────────────────────────────────────────────────────────────
-- MIGRATION: adds product reviews (run against your existing Neon DB).
-- ─────────────────────────────────────────────────────────────────────────
-- CREATE TABLE IF NOT EXISTS product_reviews (
--     id SERIAL PRIMARY KEY,
--     product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
--     customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
--     customer_name TEXT NOT NULL,
--     rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
--     comment TEXT,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--     UNIQUE (product_id, customer_id)
-- );
-- CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);