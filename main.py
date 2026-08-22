import hashlib
import hmac
import os
import re
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator, model_validator
import psycopg2
from psycopg2 import pool as pg_pool
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Admin-Secret", "X-Customer-Token"],
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
    "bag-charms",
    "other_items",
}

MAX_PRODUCT_IMAGES = 10

_TAG_RE = re.compile(r"<[^>]*>")
_KENYA_PHONE_RE = re.compile(r"^(?:\+254|0)7\d{8}$|^(?:\+254|0)1\d{8}$")


def strip_tags(value: str) -> str:
    """Removes any HTML/script tags from user-supplied text. We don't store
    or render rich text anywhere, so tags are never legitimate input."""
    return _TAG_RE.sub("", value).strip()


# A small pool reused across requests handled by the same warm serverless
# instance, so we're not paying for a fresh TCP/TLS handshake to Neon on
# every request. connect_timeout keeps us from hanging if the DB is
# unreachable or slow to wake from autosuspend -- we'd rather fail fast
# and let the frontend show its error state than time out the whole
# function.
_db_pool: pg_pool.SimpleConnectionPool | None = None


def _get_pool() -> pg_pool.SimpleConnectionPool:
    global _db_pool
    if _db_pool is None:
        _db_pool = pg_pool.SimpleConnectionPool(
            1,
            5,
            dsn=os.getenv("DATABASE_URL"),
            connect_timeout=5,
        )
    return _db_pool


class _PooledConnection:
    """Thin proxy around a pooled connection so existing endpoint code can
    keep calling conn.cursor() / conn.commit() / conn.rollback() /
    conn.close() unchanged -- close() returns the connection to the pool
    instead of actually tearing down the TCP connection."""

    def __init__(self, pool_: pg_pool.SimpleConnectionPool, conn):
        self._pool = pool_
        self._conn = conn

    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        # If something left the connection mid-transaction or broken,
        # don't hand that state to the next request -- discard it and
        # let the pool open a fresh one next time.
        broken = self._conn.closed or self._conn.get_transaction_status() not in (
            psycopg2.extensions.TRANSACTION_STATUS_IDLE,
        )
        self._pool.putconn(self._conn, close=broken)


def get_conn() -> _PooledConnection:
    p = _get_pool()
    conn = p.getconn()
    return _PooledConnection(p, conn)


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


CUSTOMER_SESSION_DAYS = 30
_customer_login_attempts: dict[str, list[float]] = defaultdict(list)


def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 with a random per-password salt -- no extra
    dependency needed since both pieces are in the stdlib. Stored as
    'salt_hex$hash_hex' so verify_password doesn't need a separate column."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest_hex = stored.split("$", 1)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000)
    return hmac.compare_digest(candidate.hex(), digest_hex)


def _is_customer_locked_out(ip: str) -> bool:
    now = time.time()
    attempts = [t for t in _customer_login_attempts[ip] if now - t < LOCKOUT_WINDOW_SECONDS]
    _customer_login_attempts[ip] = attempts
    if len(attempts) < LOCKOUT_THRESHOLD:
        return False
    return now - attempts[-1] < LOCKOUT_DURATION_SECONDS


def _record_customer_failure(ip: str) -> None:
    now = time.time()
    attempts = [t for t in _customer_login_attempts[ip] if now - t < LOCKOUT_WINDOW_SECONDS]
    attempts.append(now)
    _customer_login_attempts[ip] = attempts


def create_customer_session(cur, customer_id: int) -> str:
    """Issues a random 32-byte token and stores it in customer_sessions with
    a 30-day expiry. Called on both register and login so either one leaves
    the customer signed in immediately."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=CUSTOMER_SESSION_DAYS)
    cur.execute(
        "INSERT INTO customer_sessions (customer_id, token, expires_at) VALUES (%s, %s, %s);",
        (customer_id, token, expires_at),
    )
    return token


def get_current_customer(
    x_customer_token: str | None = Header(default=None, alias="X-Customer-Token"),
):
    """Dependency guarding every customer-account route (placing an order,
    viewing 'My Orders'). Looks up the session by token and rejects if it's
    missing, unknown, or expired -- same generic 401 either way so a bad
    token can't be distinguished from an expired one."""
    if not x_customer_token:
        raise HTTPException(status_code=401, detail="Not logged in")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT c.id, c.name, c.phone
        FROM customer_sessions s
        JOIN customers c ON c.id = s.customer_id
        WHERE s.token = %s AND s.expires_at > now();
        """,
        (x_customer_token,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    return {"id": row[0], "name": row[1], "phone": row[2]}


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
    sale_price: float | None = None
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

    @field_validator("sale_price")
    @classmethod
    def validate_sale_price(cls, v: float | None) -> float | None:
        if v is None:
            return v
        if v < 0 or v > 10_000_000:
            raise ValueError("sale price out of range")
        return round(v, 2)

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        if v < 0 or v > 1_000_000:
            raise ValueError("quantity out of range")
        return v

    def check_sale_below_price(self) -> None:
        if self.sale_price is not None and self.sale_price >= self.price:
            raise ValueError("sale price must be lower than the regular price")

    @model_validator(mode="after")
    def _validate_sale_price_below_price(self):
        if self.sale_price is not None and self.sale_price >= self.price:
            raise ValueError("sale price must be lower than the regular price")
        return self


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


class CustomerRegister(BaseModel):
    name: str
    phone: str
    password: str

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

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not (6 <= len(v) <= 200):
            raise ValueError("password must be at least 6 characters")
        return v


class CustomerLogin(BaseModel):
    phone: str
    password: str

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
    # customer_name/customer_phone used to come from the client -- they now
    # come from the logged-in session (see get_current_customer) so a
    # request can't place an order as someone else just by editing the body.
    items: list[OrderItemCreate]

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


class ReviewCreate(BaseModel):
    rating: int
    comment: str | None = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("rating must be between 1 and 5")
        return v

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = strip_tags(v).strip()
        if len(v) > 2000:
            raise ValueError("comment is too long")
        return v or None


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
            SELECT id, name, description, price, sale_price, category, quantity, is_new
            FROM products WHERE category = %s ORDER BY created_at DESC;
            """,
            (category,),
        )
    else:
        cur.execute(
            """
            SELECT id, name, description, price, sale_price, category, quantity, is_new
            FROM products ORDER BY created_at DESC;
            """
        )
    rows = cur.fetchall()
    product_ids = [r[0] for r in rows]

    # One query for every product's thumbnail instead of one query per
    # product (was causing 50+ sequential round trips to the DB on a
    # full catalogue load). DISTINCT ON picks the same "best" image per
    # product as before -- a photo over a demo video, then is_primary,
    # then sort_order -- in a single pass.
    thumbnails: dict[int, str] = {}
    if product_ids:
        cur.execute(
            """
            SELECT DISTINCT ON (product_id) product_id, blob_url
            FROM product_images
            WHERE product_id = ANY(%s)
            ORDER BY product_id, (media_type = 'image') DESC, is_primary DESC, sort_order ASC;
            """,
            (product_ids,),
        )
        thumbnails = {pid: url for pid, url in cur.fetchall()}

    # One query for every product's rating summary, same batching approach
    # as the thumbnails above -- powers the star rating shown on each card.
    ratings: dict[int, dict] = {}
    if product_ids:
        cur.execute(
            """
            SELECT product_id, AVG(rating), COUNT(*)
            FROM product_reviews WHERE product_id = ANY(%s) GROUP BY product_id;
            """,
            (product_ids,),
        )
        ratings = {pid: {"avg": float(avg), "count": count} for pid, avg, count in cur.fetchall()}

    products = [
        {
            "id": r[0],
            "name": r[1],
            "description": r[2],
            "price": float(r[3]),
            "sale_price": float(r[4]) if r[4] is not None else None,
            "category": r[5],
            "quantity": r[6],
            "is_new": r[7],
            "image_url": thumbnails.get(r[0]),
            "avg_rating": ratings.get(r[0], {}).get("avg"),
            "review_count": ratings.get(r[0], {}).get("count", 0),
        }
        for r in rows
    ]

    cur.close()
    conn.close()
    return products


@app.get("/products/{product_id}")
@limiter.limit("60/minute")
def get_product(request: Request, product_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, name, description, price, sale_price, category, quantity, is_new FROM products WHERE id = %s;",
        (product_id,),
    )
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Product not found")

    cur.execute(
        "SELECT id, blob_url, media_type, is_primary FROM product_images WHERE product_id = %s ORDER BY is_primary DESC, sort_order ASC;",
        (product_id,),
    )
    images = [{"id": r[0], "url": r[1], "media_type": r[2], "is_primary": r[3]} for r in cur.fetchall()]

    cur.execute(
        "SELECT AVG(rating), COUNT(*) FROM product_reviews WHERE product_id = %s;",
        (product_id,),
    )
    avg_rating, review_count = cur.fetchone()
    cur.close()
    conn.close()

    return {
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "price": float(row[3]),
        "sale_price": float(row[4]) if row[4] is not None else None,
        "category": row[5],
        "quantity": row[6],
        "is_new": row[7],
        "images": images,
        "avg_rating": float(avg_rating) if avg_rating is not None else None,
        "review_count": review_count or 0,
    }


@app.get("/products/{product_id}/reviews")
@limiter.limit("60/minute")
def list_product_reviews(request: Request, product_id: int):
    """Public -- every review left on this product, newest first. Powers
    the review list shown under a product's description."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, customer_name, rating, comment, created_at
        FROM product_reviews WHERE product_id = %s ORDER BY created_at DESC;
        """,
        (product_id,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {"id": r[0], "customer_name": r[1], "rating": r[2], "comment": r[3], "created_at": r[4].isoformat()}
        for r in rows
    ]


@app.post("/products/{product_id}/reviews")
@limiter.limit("5/minute")
def create_product_review(
    request: Request,
    product_id: int,
    review: ReviewCreate,
    customer: dict = Depends(get_current_customer),
):
    """Requires a logged-in customer, same account system as checkout, so
    reviews can't be spammed anonymously. One review per customer per
    product -- posting again updates the existing one instead of erroring,
    so someone can revise their rating without contacting support."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM products WHERE id = %s;", (product_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Product not found")

        cur.execute(
            """
            INSERT INTO product_reviews (product_id, customer_id, customer_name, rating, comment)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (product_id, customer_id)
            DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = now()
            RETURNING id;
            """,
            (product_id, customer["id"], customer["name"], review.rating, review.comment),
        )
        review_id = cur.fetchone()[0]
        conn.commit()
        return {"id": review_id, "message": "Review saved"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Could not save review")
    finally:
        cur.close()
        conn.close()


@app.post("/admin/products", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
def create_product(request: Request, product: ProductCreate, force: bool = False):
    validate_category(product.category)
    conn = get_conn()
    cur = conn.cursor()

    # Duplicate-entry guard: catches the same product being added twice
    # (forgotten earlier entry, two staff members, a retried request after a
    # timeout, etc). Matches on name + category, case/whitespace-insensitive.
    # `force=true` lets an admin deliberately add a second listing that just
    # happens to share a name (e.g. two colourways of the same design).
    if not force:
        cur.execute(
            """
            SELECT id, quantity, price FROM products
            WHERE lower(trim(name)) = lower(trim(%s)) AND category = %s
            LIMIT 1;
            """,
            (product.name, product.category),
        )
        existing = cur.fetchone()
        if existing:
            cur.close()
            conn.close()
            raise HTTPException(
                status_code=409,
                detail={
                    "message": f"A product named \"{product.name}\" already exists in this category.",
                    "existing_product_id": existing[0],
                    "existing_quantity": existing[1],
                    "existing_price": float(existing[2]),
                },
            )

    cur.execute(
        """
        INSERT INTO products (name, description, price, sale_price, category, quantity, is_new)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (product.name, product.description, product.price, product.sale_price, product.category, product.quantity, product.is_new),
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


@app.patch("/admin/products/{product_id}/images/{image_id}/primary", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
def set_primary_product_image(request: Request, product_id: int, image_id: int):
    """Marks one image as the product's main/lead photo (e.g. the model shot)
    and un-sets is_primary on every other image for that product."""
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        "SELECT id FROM product_images WHERE id = %s AND product_id = %s;",
        (image_id, product_id),
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Image not found on this product")

    cur.execute(
        "UPDATE product_images SET is_primary = (id = %s) WHERE product_id = %s;",
        (image_id, product_id),
    )
    conn.commit()
    cur.close()
    conn.close()
    return {"message": "Main image updated"}


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
        SET name = %s, description = %s, price = %s, sale_price = %s, category = %s, quantity = %s, is_new = %s
        WHERE id = %s;
        """,
        (product.name, product.description, product.price, product.sale_price, product.category, product.quantity, product.is_new, product_id),
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
    """DEPRECATED: this was the old lead-capture flow (name + phone, no
    password) that ran before every add-to-bag. The storefront now uses
    POST /auth/register instead, which creates a real account. Left in
    place only for backward compatibility -- nothing in the current
    frontend calls this anymore."""
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


@app.post("/auth/register")
@limiter.limit("5/minute")
def register_customer(request: Request, body: CustomerRegister):
    """Creates a real customer account (name + phone + password) and logs
    them straight in. If this phone already has a row from the old
    lead-capture flow (no password set), that row is claimed rather than
    rejected -- so past 'quick registration' customers aren't locked out of
    their own phone number when they sign up for real."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, password_hash FROM customers WHERE phone = %s;", (body.phone,))
        existing = cur.fetchone()
        pw_hash = hash_password(body.password)

        if existing and existing[1]:
            raise HTTPException(status_code=409, detail="An account with this phone number already exists. Please log in.")
        elif existing:
            customer_id = existing[0]
            cur.execute(
                "UPDATE customers SET name = %s, password_hash = %s WHERE id = %s;",
                (body.name, pw_hash, customer_id),
            )
        else:
            cur.execute(
                "INSERT INTO customers (name, phone, password_hash) VALUES (%s, %s, %s) RETURNING id;",
                (body.name, body.phone, pw_hash),
            )
            customer_id = cur.fetchone()[0]

        token = create_customer_session(cur, customer_id)
        conn.commit()
        return {"token": token, "name": body.name, "phone": body.phone}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Could not create account")
    finally:
        cur.close()
        conn.close()


@app.post("/auth/login")
@limiter.limit("10/minute")
def login_customer(request: Request, body: CustomerLogin):
    """Verifies phone + password and issues a new session token. Locked out
    per-IP after repeated failures, same as admin login, with a generic
    error either way so a guess can't tell 'wrong phone' from 'wrong
    password'."""
    ip = get_remote_address(request)
    if _is_customer_locked_out(ip):
        raise HTTPException(status_code=401, detail="Too many attempts. Try again later.")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, name, password_hash FROM customers WHERE phone = %s;", (body.phone,))
        row = cur.fetchone()
        if not row or not row[2] or not verify_password(body.password, row[2]):
            _record_customer_failure(ip)
            raise HTTPException(status_code=401, detail="Incorrect phone number or password")

        customer_id, name, _ = row
        token = create_customer_session(cur, customer_id)
        conn.commit()
        return {"token": token, "name": name, "phone": body.phone}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Could not log in")
    finally:
        cur.close()
        conn.close()


@app.post("/auth/logout")
def logout_customer(x_customer_token: str | None = Header(default=None, alias="X-Customer-Token")):
    """Deletes the session row so the token can't be reused, then the
    client drops it from local storage."""
    if not x_customer_token:
        return {"message": "Logged out"}
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM customer_sessions WHERE token = %s;", (x_customer_token,))
    conn.commit()
    cur.close()
    conn.close()
    return {"message": "Logged out"}


@app.get("/auth/me")
def get_me(customer: dict = Depends(get_current_customer)):
    """Lets the frontend confirm a stored token is still valid and greet
    the customer by name after a page refresh."""
    return customer


@app.get("/orders/mine")
def list_my_orders(customer: dict = Depends(get_current_customer)):
    """Powers the customer-facing 'My Orders' view -- every order this
    logged-in customer has placed, with line items, newest first."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, subtotal, status, created_at
        FROM orders WHERE customer_id = %s ORDER BY created_at DESC;
        """,
        (customer["id"],),
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
                "subtotal": float(o[1]),
                "status": o[2],
                "created_at": o[3].isoformat(),
                "items": items,
            }
        )
    cur.close()
    conn.close()
    return result


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
def create_order(request: Request, order: OrderCreate, customer: dict = Depends(get_current_customer)):
    """Logs a checkout for the logged-in customer. Payment isn't wired to
    the real M-Pesa Daraja API yet -- the order is saved with status
    'pending' and an admin marks it 'paid' manually from the admin panel
    once payment is confirmed by other means (call/SMS). Item prices are
    looked up fresh from the products table server-side rather than
    trusting whatever price the client sent, so a tampered request can't
    under-charge. customer_name/customer_phone come from the authenticated
    session, not the request body, so an order can't be placed as someone
    else."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        line_items = []
        subtotal = 0.0
        for item in order.items:
            cur.execute(
                "SELECT name, price, sale_price FROM products WHERE id = %s;",
                (item.product_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
            name, base_price, sale_price = row[0], float(row[1]), (float(row[2]) if row[2] is not None else None)
            # Charge whatever price is actually displayed on the storefront --
            # if a sale price is active, that's what the customer agreed to pay.
            price = sale_price if sale_price is not None else base_price
            line_items.append((item.product_id, name, price, item.quantity))
            subtotal += price * item.quantity

        cur.execute(
            """
            INSERT INTO orders (customer_id, customer_name, customer_phone, subtotal, status)
            VALUES (%s, %s, %s, %s, 'pending')
            RETURNING id;
            """,
            (customer["id"], customer["name"], customer["phone"], round(subtotal, 2)),
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