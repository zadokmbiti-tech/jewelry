import hmac
import os
import re
import time
from collections import defaultdict

from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
import psycopg2
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

app = FastAPI()

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_default_origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "https://sjgemsjewelryhomepage.vercel.app",
]
_env_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = _env_origins or _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-Admin-Secret"],
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
    "hypoallergenic-watches",
    "genuine-leather-watches",
    "elite-compact-jewelry-case",
    "charger-protectors",
    "brass-jewelry",
    "hair-clips",
    "twist-fabric-headband",
    "pearl-twist-headband",
    "magnetic-and-generic-watches",
    "kids-pocket-mirrors",
    "adult-pocket-mirrors",
    "anxiety-rings",
    "brass-rings",
    "stainless-steel-rings",
    "xuping-rings",
    "classic-jewelry-organizers",
    "statement-rings",
    "kids-digital-watches",
    "sunglasses",
    "photochromic-glasses",
    "premium-wine-bottle-gift-box",
    "anti-blue-light-glasses",
    "ruched-rhinestone-headband",
    "pearl-and-rhinestones-headband",
    "crystal-satin-ruche-headband",
    "travel-bags",
    "stainless-steel-necklaces",
    "mens-watches",
    "tennis-bracelets",
    "xuping-bangles",
    "xuping-tennis-bracelets",
    "xuping-bracelets",
    "brass-necklaces",
}

MAX_PRODUCT_IMAGES = 10

_TAG_RE = re.compile(r"<[^>]*>")
_KENYA_PHONE_RE = re.compile(r"^(?:\+254|0)7\d{8}$|^(?:\+254|0)1\d{8}$")


def strip_tags(value: str) -> str:
    """Removes any HTML/script tags from user-supplied text. We don't store
    or render rich text anywhere, so tags are never legitimate input."""
    return _TAG_RE.sub("", value).strip()


def get_conn():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


_failed_attempts: dict[str, list[float]] = defaultdict(list)
LOCKOUT_THRESHOLD = 5
LOCKOUT_WINDOW_SECONDS = 15 * 60
LOCKOUT_DURATION_SECONDS = 15 * 60


def _record_failure(ip: str) -> None:
    now = time.time()
    attempts = [t for t in _failed_attempts[ip] if now - t < LOCKOUT_WINDOW_SECONDS]
    attempts.append(now)
    _failed_attempts[ip] = attempts


def _is_locked_out(ip: str) -> bool:
    now = time.time()
    attempts = [t for t in _failed_attempts[ip] if now - t < LOCKOUT_WINDOW_SECONDS]
    _failed_attempts[ip] = attempts
    if len(attempts) < LOCKOUT_THRESHOLD:
        return False
    return now - attempts[-1] < LOCKOUT_DURATION_SECONDS


def require_admin(
    request: Request,
    x_admin_secret: str | None = Header(default=None, alias="X-Admin-Secret"),
):
    """Dependency guarding every /admin/* route. Rejects unless the request
    carries the shared secret configured via ADMIN_SECRET, using a
    constant-time comparison so response timing can't leak how much of the
    guess was correct. Also locks out an IP for 15 minutes after 5
    consecutive failures, with the same generic message either way."""
    expected = os.getenv("ADMIN_SECRET")
    if not expected:
        raise HTTPException(status_code=500, detail="Server misconfigured: ADMIN_SECRET not set")

    ip = get_remote_address(request)
    if _is_locked_out(ip):
        raise HTTPException(status_code=401, detail="Unauthorized")

    provided = x_admin_secret or ""
    valid = bool(x_admin_secret) and hmac.compare_digest(provided, expected)
    if not valid:
        _record_failure(ip)
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

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = strip_tags(v)
        if not (1 <= len(v) <= 200):
            raise ValueError("name must be between 1 and 200 characters")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = strip_tags(v)
        if len(v) > 2000:
            raise ValueError("description must be at most 2000 characters")
        return v or None

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v < 0 or v > 10_000_000:
            raise ValueError("price out of range")
        return round(v, 2)

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        if v < 0 or v > 1_000_000:
            raise ValueError("quantity out of range")
        return v


class ProductUpdate(ProductCreate):
    pass


class ProductImageCreate(BaseModel):
    blob_url: str
    is_primary: bool = False
    sort_order: int = 0
    media_type: str = "image"

    @field_validator("blob_url")
    @classmethod
    def validate_blob_url(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("https://") or v.startswith("http://")):
            raise ValueError("blob_url must be an absolute http(s) URL")
        if len(v) > 2000:
            raise ValueError("blob_url too long")
        return v

    @field_validator("media_type")
    @classmethod
    def validate_media_type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in {"image", "video"}:
            raise ValueError("media_type must be 'image' or 'video'")
        return v


class CustomerCreate(BaseModel):
    name: str
    phone: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = strip_tags(v)
        if not (1 <= len(v) <= 120):
            raise ValueError("name must be between 1 and 120 characters")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if not _KENYA_PHONE_RE.match(v):
            raise ValueError("phone must be a valid Kenyan number, e.g. 07XXXXXXXX or +2547XXXXXXXX")
        return v


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        if v < 1 or v > 1000:
            raise ValueError("quantity must be between 1 and 1000")
        return v


class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    items: list[OrderItemCreate]

    @field_validator("customer_name")
    @classmethod
    def validate_customer_name(cls, v: str) -> str:
        v = strip_tags(v)
        if not (1 <= len(v) <= 120):
            raise ValueError("customer_name must be between 1 and 120 characters")
        return v

    @field_validator("customer_phone")
    @classmethod
    def validate_customer_phone(cls, v: str) -> str:
        v = v.strip()
        if not _KENYA_PHONE_RE.match(v):
            raise ValueError("customer_phone must be a valid Kenyan number, e.g. 07XXXXXXXX or +2547XXXXXXXX")
        return v

    @field_validator("items")
    @classmethod
    def validate_items(cls, v: list) -> list:
        if not v:
            raise ValueError("items must contain at least one product")
        if len(v) > 100:
            raise ValueError("too many distinct items")
        return v


class OrderStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in {"pending", "paid", "cancelled"}:
            raise ValueError("status must be one of: pending, paid, cancelled")
        return v


@app.get("/")
def read_root():
    return {"status": "running"}


@app.post("/admin/ping", dependencies=[Depends(require_admin)])
@limiter.limit("10/minute")
def admin_ping(request: Request):
    """Used purely to validate an admin password from the client before
    revealing the admin dashboard \u2014 returns 200 if the secret is correct,
    401 (via require_admin) otherwise. POST (not GET) so the secret never
    ends up in a query string / access log, and rate-limited since it's the
    brute-force target for ADMIN_SECRET."""
    return {"ok": True}


@app.get("/products")
@limiter.limit("60/minute")
def get_products(request: Request, category: str | None = None):
    if category is not None and category not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail="Invalid category")
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
        # Grid thumbnails always prefer a photo over a demo video when a
        # product has both -- the video still plays in the product detail
        # view, but a still photo makes a better catalogue-card thumbnail.
        cur.execute(
            """
            SELECT blob_url FROM product_images WHERE product_id = %s
            ORDER BY (media_type = 'image') DESC, is_primary DESC, sort_order ASC LIMIT 1;
            """,
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
@limiter.limit("60/minute")
def get_product(request: Request, product_id: int):
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
        "SELECT id, blob_url, media_type FROM product_images WHERE product_id = %s ORDER BY is_primary DESC, sort_order ASC;",
        (product_id,),
    )
    images = [{"id": r[0], "url": r[1], "media_type": r[2]} for r in cur.fetchall()]
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
@limiter.limit("30/minute")
def create_product(request: Request, product: ProductCreate):
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
@limiter.limit("30/minute")
def add_product_image(request: Request, product_id: int, image: ProductImageCreate):
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
        raise HTTPException(status_code=400, detail=f"A product can have at most {MAX_PRODUCT_IMAGES} photos/videos")

    cur.execute(
        """
        INSERT INTO product_images (product_id, blob_url, is_primary, sort_order, media_type)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (product_id, image.blob_url, image.is_primary, image.sort_order, image.media_type),
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return {"id": new_id, "message": "Image added"}


@app.delete("/admin/products/{product_id}/images/{image_id}", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
def delete_product_image(request: Request, product_id: int, image_id: int):
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
@limiter.limit("30/minute")
def clear_product_images(request: Request, product_id: int):
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
@limiter.limit("30/minute")
def update_product(request: Request, product_id: int, product: ProductUpdate):
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
@limiter.limit("30/minute")
def delete_product(request: Request, product_id: int):
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
@limiter.limit("5/minute")
def create_customer(request: Request, customer: CustomerCreate):
    """Records a customer's name + phone before they can add an item to
    their bag. No password, no login \u2014 this is a lightweight lead capture,
    not an account system. Rate-limited since it's a public, unauthenticated
    write endpoint and otherwise an easy target for spamming the table."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO customers (name, phone) VALUES (%s, %s) RETURNING id;",
        (customer.name, customer.phone),
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return {"id": new_id, "message": "Registered"}


@app.get("/admin/customers", dependencies=[Depends(require_admin)])
@limiter.limit("20/minute")
def list_customers(request: Request):
    """Powers the admin panel's Customers tab: name, phone, and signup date
    for everyone who's registered via the Add-to-Bag flow."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, name, phone, created_at FROM customers ORDER BY created_at DESC;")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [{"id": r[0], "name": r[1], "phone": r[2], "created_at": r[3].isoformat()} for r in rows]


@app.post("/orders")
@limiter.limit("10/minute")
def create_order(request: Request, order: OrderCreate):
    """Logs a checkout. Payment isn't wired to the real M-Pesa Daraja API
    yet -- the order is saved with status 'pending' and an admin marks it
    'paid' manually from the admin panel once payment is confirmed by other
    means (call/SMS). Item prices are looked up fresh from the products
    table server-side rather than trusting whatever price the client sent,
    so a tampered request can't under-charge."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        line_items = []
        subtotal = 0.0
        for item in order.items:
            cur.execute(
                "SELECT name, price FROM products WHERE id = %s;",
                (item.product_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
            name, price = row[0], float(row[1])
            line_items.append((item.product_id, name, price, item.quantity))
            subtotal += price * item.quantity

        cur.execute(
            "SELECT id FROM customers WHERE phone = %s ORDER BY created_at DESC LIMIT 1;",
            (order.customer_phone,),
        )
        cust_row = cur.fetchone()
        customer_id = cust_row[0] if cust_row else None

        cur.execute(
            """
            INSERT INTO orders (customer_id, customer_name, customer_phone, subtotal, status)
            VALUES (%s, %s, %s, %s, 'pending')
            RETURNING id;
            """,
            (customer_id, order.customer_name, order.customer_phone, round(subtotal, 2)),
        )
        order_id = cur.fetchone()[0]

        for product_id, name, price, quantity in line_items:
            cur.execute(
                """
                INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (order_id, product_id, name, price, quantity),
            )

        conn.commit()
        return {"id": order_id, "subtotal": round(subtotal, 2), "message": "Order placed"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Could not place order")
    finally:
        cur.close()
        conn.close()


@app.get("/admin/orders", dependencies=[Depends(require_admin)])
@limiter.limit("20/minute")
def list_orders(request: Request):
    """Powers the admin panel's Orders tab: every order with its line items,
    so admin can see what was ordered, by whom, and whether it's been paid."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, customer_name, customer_phone, subtotal, status, created_at
        FROM orders ORDER BY created_at DESC;
        """
    )
    orders = cur.fetchall()

    result = []
    for o in orders:
        order_id = o[0]
        cur.execute(
            "SELECT product_name, price, quantity FROM order_items WHERE order_id = %s;",
            (order_id,),
        )
        items = [{"name": r[0], "price": float(r[1]), "quantity": r[2]} for r in cur.fetchall()]
        result.append(
            {
                "id": order_id,
                "customer_name": o[1],
                "customer_phone": o[2],
                "subtotal": float(o[3]),
                "status": o[4],
                "created_at": o[5].isoformat(),
                "items": items,
            }
        )

    cur.close()
    conn.close()
    return result


@app.put("/admin/orders/{order_id}/status", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
def update_order_status(request: Request, order_id: int, body: OrderStatusUpdate):
    """Lets admin manually mark an order paid or cancelled until real M-Pesa
    STK push confirmation is integrated."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE orders SET status = %s WHERE id = %s RETURNING id;",
        (body.status, order_id),
    )
    updated = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not updated:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order updated"}