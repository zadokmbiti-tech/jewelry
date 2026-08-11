-- Ruaka Jewelry Dealer — database schema
-- Run this once against your Postgres database (Neon/Supabase) before using the API.

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'xuping-sets',
        'xuping-earrings',
        'genuine-leather-belts',
        'kids-xuping-earrings',
        'xuping-necklaces',
        'pearl-necklaces',
        'P.u-leather-belts',
        'male-stainless-steel-sets',
        'statement-stainless-earrings',
        'fashion-jewelry-necklace-sets'
    )),
    materials TEXT[] NOT NULL DEFAULT '{}',
    is_new BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    blob_url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
