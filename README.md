# SJ Gems Jewelry E-Commerce Platform

A full-stack e-commerce and information management platform developed for a
jewelry retailer in Ruaka, Kenya.

The platform provides a customer-facing product catalogue, customer accounts,
shopping and order management, product reviews, and an administrative interface
for managing products, customers, media and orders.

## Overview

The system was designed to digitise key retail operations while providing
structured storage and retrieval of product, customer and order information.

### Key capabilities

- Product catalogue with categories, descriptions, pricing and stock quantities
- Product search and browsing
- Customer registration and authentication
- Secure password hashing
- Customer sessions with expiry
- Shopping cart and checkout workflow
- Order creation and order-history tracking
- Product reviews and 1–5 star ratings
- Administrative customer management
- Administrative product management
- Product image and video uploads
- Order status management
- Database-backed information storage and retrieval
- API-based frontend/backend communication
- Request rate limiting and authentication controls

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| API | REST-style FastAPI endpoints |
| Authentication | Session tokens, PBKDF2-HMAC-SHA256 password hashing |
| Media Storage | Vercel Blob |
| Deployment | Vercel / cloud-hosted services |
| Security | Rate limiting, admin authentication, IP lockout, CORS controls |

## Information Management

The platform uses a relational PostgreSQL database to organise several
categories of operational information.

### Core entities

- **Products** — product details, categories, pricing and inventory quantities
- **Customers** — customer identity and account information
- **Customer Sessions** — authenticated session tokens and expiry information
- **Orders** — customer orders, totals, status and timestamps
- **Order Items** — individual products and quantities within each order
- **Product Reviews** — customer ratings and comments

Relationships between entities are enforced using PostgreSQL foreign keys and
constraints.

Indexes are also used on frequently queried fields such as product categories,
product images, order dates and review relationships.

## API

The FastAPI backend exposes endpoints for:

### Products

- `GET /products`
- `GET /products/{product_id}`
- `GET /products/{product_id}/reviews`
- `POST /products/{product_id}/reviews`

### Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Customer Orders

- `POST /orders`
- `GET /orders/mine`

### Administration

- `POST /admin/products`
- `PUT /admin/products/{product_id}`
- `DELETE /admin/products/{product_id}`
- `GET /admin/customers`
- `GET /admin/orders`
- `PUT /admin/orders/{order_id}/status`

## Security

The backend implements several security measures:

- Passwords are stored using PBKDF2-HMAC-SHA256 with per-password salts.
- Customer sessions use randomly generated tokens with expiry.
- Administrative endpoints require an admin secret.
- Administrative authentication uses constant-time comparison.
- Failed administrative authentication attempts trigger temporary IP
  lockout.
- Customer authentication is rate-limited.
- API endpoints use request rate limiting.
- CORS is configured using an allow-list of permitted origins.
- Server-side product prices are retrieved from the database when creating
  orders rather than trusting client-supplied prices.

## Database Design

The PostgreSQL schema contains relational tables for:

```text
products
    │
    ├── product_images
    └── product_reviews
            │
            └── customers
                    │
                    ├── customer_sessions
                    └── orders
                            │
                            └── order_items
## Frontend structure and SEO pages

- `frontend/index.html`, `about.html`, `help-center.html` are the public pages. The shop code lives in `frontend/app.js` and the styles in `frontend/styles.css`.
- The admin interface is **not** part of the public HTML. `frontend/admin-panel.html` (markup) and `frontend/admin.js` (code) are loaded on demand the first time an admin opens the panel. Access is still enforced by the `X-Admin-Secret` check on the API.
- Category landing pages live in `frontend/c/<group>/` and `frontend/c/<group>/<category>/`. They are generated, so do not edit them by hand. After adding, renaming or removing a category in `CATEGORY_META` / `CATEGORY_GROUPS` (in `frontend/app.js`), run:

  ```
  node scripts/build-categories.js
  ```

  and commit the result. The script also refreshes the Menu dropdown, the footer Shop links and `frontend/sitemap.xml`.
