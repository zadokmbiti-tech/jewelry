from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_CATEGORIES = {
    "xuping-sets",
    "xuping-earrings",
    "genuine-leather-belts",
    "kids-xuping-earrings",
    "xuping-necklaces",
    "pearl-necklaces",
    "pu-leather-belts",
    "male-stainless-steel-sets",
    "statement-stainless-earrings",
    "fashion-jewelry-necklace-sets",
}

MAX_PRODUCT_IMAGES = 3


def get_conn():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def require_admin(x_admin_secret: str | None = Header(default=None, alias="X-Admin-Secret")):
    """Dependency guarding every /admin/* route. Reject the request unless it
    carries the shared secret configured via the ADMIN_SECRET env var."""
    expected = os.getenv("ADMIN_SECRET")
    if not expected:
        # Fail closed: if the server isn't configured with a secret, refuse
        # rather than silently letting everyone in.
        raise HTTPException(status_code=500, detail="Server misconfigured: ADMIN_SECRET not set")
    if not x_admin_secret or x_admin_secret != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


def validate_category(category: str) -> str:
    if category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}",
        )
    return category


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    price: float
    category: str
    quantity: int = 0
    is_new: bool = False


class ProductUpdate(BaseModel):
    name: str
    description: str | None = None
    price: float
    category: str
    quantity: int = 0
    is_new: bool = False


class ProductImageCreate(BaseModel):
    blob_url: str
    is_primary: bool = False
    sort_order: int = 0


class CustomerCreate(BaseModel):
    name: str
    phone: str


@app.get("/")
def read_root():
    return {"status": "running"}


@app.get("/admin/ping", dependencies=[Depends(require_admin)])
def admin_ping():
    """Used purely to validate an admin password from the client before
    revealing the admin dashboard \u2014 returns 200 if the secret is correct,
    401 (via require_admin) otherwise."""
    return {"ok": True}


@app.get("/products")
def get_products(category: str | None = None):
    conn = get_conn()
    cur = conn.cursor()
    if category:
        cur.execute(
            """
            SELECT id, name, description, price, category, quantity, is_new
            FROM products WHERE category = %s ORDER BY created_at DESC;
            """,
            (category,),
        )
    else:
        cur.execute(
            """
            SELECT id, name, description, price, category, quantity, is_new
            FROM products ORDER BY created_at DESC;
            """
        )
    rows = cur.fetchall()

    products = []
    for r in rows:
        product_id = r[0]
        cur.execute(
            "SELECT blob_url FROM product_images WHERE product_id = %s ORDER BY is_primary DESC, sort_order ASC LIMIT 1;",
            (product_id,),
        )
        img_row = cur.fetchone()
        products.append(
            {
                "id": r[0],
                "name": r[1],
                "description": r[2],
                "price": float(r[3]),
                "category": r[4],
                "quantity": r[5],
                "is_new": r[6],
                "image_url": img_row[0] if img_row else None,
            }
        )

    cur.close()
    conn.close()
    return products


@app.get("/products/{product_id}")
def get_product(product_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, name, description, price, category, quantity, is_new FROM products WHERE id = %s;",
        (product_id,),
    )
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Product not found")

    cur.execute(
        "SELECT id, blob_url FROM product_images WHERE product_id = %s ORDER BY is_primary DESC, sort_order ASC;",
        (product_id,),
    )
    images = [{"id": r[0], "url": r[1]} for r in cur.fetchall()]
    cur.close()
    conn.close()

    return {
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "price": float(row[3]),
        "category": row[4],
        "quantity": row[5],
        "is_new": row[6],
        "images": images,
    }


@app.post("/admin/products", dependencies=[Depends(require_admin)])
def create_product(product: ProductCreate):
    validate_category(product.category)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO products (name, description, price, category, quantity, is_new)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (product.name, product.description, product.price, product.category, product.quantity, product.is_new),
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return {"id": new_id, "message": "Product created"}


@app.post("/admin/products/{product_id}/images", dependencies=[Depends(require_admin)])
def add_product_image(product_id: int, image: ProductImageCreate):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT id FROM products WHERE id = %s;", (product_id,))
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Product not found")

    cur.execute("SELECT COUNT(*) FROM product_images WHERE product_id = %s;", (product_id,))
    existing_count = cur.fetchone()[0]
    if existing_count >= MAX_PRODUCT_IMAGES:
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail=f"A product can have at most {MAX_PRODUCT_IMAGES} images")

    cur.execute(
        """
        INSERT INTO product_images (product_id, blob_url, is_primary, sort_order)
        VALUES (%s, %s, %s, %s)
        RETURNING id;
        """,
        (product_id, image.blob_url, image.is_primary, image.sort_order),
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return {"id": new_id, "message": "Image added"}


@app.delete("/admin/products/{product_id}/images/{image_id}", dependencies=[Depends(require_admin)])
def delete_product_image(product_id: int, image_id: int):
    """Removes a single image from a product. Lets the admin UI offer a
    per-image remove button instead of only a wipe-and-replace-all flow."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM product_images WHERE id = %s AND product_id = %s RETURNING id;",
        (image_id, product_id),
    )
    deleted = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not deleted:
        raise HTTPException(status_code=404, detail="Image not found on this product")
    return {"message": "Image removed"}


@app.delete("/admin/products/{product_id}/images", dependencies=[Depends(require_admin)])
def clear_product_images(product_id: int):
    """Removes every image on a product in one call."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM products WHERE id = %s;", (product_id,))
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Product not found")

    cur.execute("DELETE FROM product_images WHERE product_id = %s;", (product_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {"message": "Images cleared"}


@app.put("/admin/products/{product_id}", dependencies=[Depends(require_admin)])
def update_product(product_id: int, product: ProductUpdate):
    validate_category(product.category)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM products WHERE id = %s;", (product_id,))
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Product not found")

    cur.execute(
        """
        UPDATE products
        SET name = %s, description = %s, price = %s, category = %s, quantity = %s, is_new = %s
        WHERE id = %s;
        """,
        (product.name, product.description, product.price, product.category, product.quantity, product.is_new, product_id),
    )
    conn.commit()
    cur.close()
    conn.close()
    return {"message": "Product updated"}


@app.delete("/admin/products/{product_id}", dependencies=[Depends(require_admin)])
def delete_product(product_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM products WHERE id = %s RETURNING id;", (product_id,))
    deleted = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}


@app.post("/customers")
def create_customer(customer: CustomerCreate):
    """Records a customer's name + phone before they can add an item to
    their bag. No password, no login  this is a lightweight lead capture,
    not an account system."""
    name = customer.name.strip()
    phone = customer.phone.strip()
    if not name or not phone:
        raise HTTPException(status_code=422, detail="name and phone are required")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO customers (name, phone) VALUES (%s, %s) RETURNING id;",
        (name, phone),
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return {"id": new_id, "message": "Registered"}


@app.get("/admin/customers", dependencies=[Depends(require_admin)])
def list_customers():
    """Not yet wired into the admin dashboard UI, but available if you want
    to pull your list of registered customers later."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, name, phone, created_at FROM customers ORDER BY created_at DESC;")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [{"id": r[0], "name": r[1], "phone": r[2], "created_at": r[3].isoformat()} for r in rows]