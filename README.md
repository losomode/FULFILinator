# FULFILinator

Order fulfillment tracking system for managing Purchase Orders, Orders, and Deliveries. Part of the **inator** microservice family.

## Architecture

FULFILinator is a full-stack application with a Django REST backend and React/TypeScript frontend.

- **Backend** — Django + DRF, SQLite (port 8003)
- **Frontend** — React, TypeScript, Vite, Tailwind CSS (port 3000)
- **Authinator** — Centralized auth service / JWT (port 8001)
- **RMAinator** — RMA tracking, sibling service (port 8002)

### Backend Apps

- **core** — Authentication (JWT via Authinator), RBAC permissions, health check
- **items** — Item catalog (name, version, MSRP, min price)
- **purchase_orders** — PO lifecycle, fulfillment status tracking, quantity waiving, admin override close
- **orders** — Order management, automatic PO allocation (oldest-first), ad-hoc orders
- **deliveries** — Delivery tracking with serial numbers, over-delivery validation, order linking
- **dashboard** — Metrics and analytics
- **notifications** — Email notifications

### Frontend Pages

- **Purchase Orders** — List, create/edit, detail with fulfillment status, waive quantities, close with override
- **Orders** — List, create/edit with PO allocation preview, detail with fulfillment tracking
- **Deliveries** — List, create/edit with order linking, serial number entry, field-level validation errors
- **Items** — Item catalog CRUD
- **Serial Search** — Look up deliveries by serial number

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Task](https://taskfile.dev/) (task runner)

### Setup

```bash
# Install all dependencies
task install

# Run database migrations
task backend:migrate

# Start backend (port 8003)
task backend:dev

# In another terminal — start frontend (port 3000)
task frontend:dev
```

### Common Tasks

```bash
task                      # List all available tasks
task test:coverage        # Run all tests with coverage (≥85% threshold)
task backend:test         # Run backend tests only
task frontend:test        # Run frontend tests only
task lint                 # Lint all code
task check                # Pre-commit checks (fmt, lint, test, coverage)
task build                # Production build
task db:reset             # Reset database (destroys all data)
task stats                # Show project statistics
```

## Testing

```bash
# All tests with coverage
task test:coverage

# Backend only
task backend:test
task backend:test:coverage

# Frontend only (239 tests, ≥85% function coverage)
task frontend:test
task frontend:test:coverage
```

## Key Features

- **PO → Order → Delivery pipeline** with automatic fulfillment status tracking at each level
- **Automatic PO allocation** — orders draw from the oldest PO first, respecting quantities and prices
- **Over-delivery prevention** — deliveries cannot exceed ordered quantities per line item
- **Serial number tracking** — every delivered item requires a unique serial number
- **Quantity waiving** — admins can waive remaining PO quantities with a reason
- **Admin override close** — force-close POs/Orders with justification when items remain
- **Field-level validation errors** — form fields highlight with the specific error from the API
- **Attachment support** — file uploads on POs, Orders, and Deliveries
- **Multi-tenant data isolation** — customers see only their own data

## User Roles

- **SYSTEM_ADMIN** — Full access to all data and features
- **CUSTOMER_ADMIN** — Manage users and data for their customer
- **CUSTOMER_USER** — View and edit their customer's data
- **CUSTOMER_READONLY** — View-only access to their customer's data

## Project Structure

```
Fulfilinator/
├── backend/
│   ├── config/              # Django settings & URLs
│   ├── core/                # Auth, permissions, health check
│   ├── items/               # Item catalog
│   ├── purchase_orders/     # PO management & fulfillment
│   ├── orders/              # Order management & PO allocation
│   ├── deliveries/          # Delivery tracking & serial numbers
│   ├── dashboard/           # Metrics & analytics
│   └── notifications/       # Email notifications
├── frontend/
│   └── src/
│       ├── api/             # API clients & types
│       ├── components/      # Shared UI components
│       ├── hooks/           # Custom React hooks
│       ├── pages/           # Route pages (POs, Orders, Deliveries, Items)
│       └── utils/           # Auth utilities
├── Taskfile.yml             # Project task runner
└── README.md
```

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
DEBUG=True
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1
AUTHINATOR_API_URL=http://localhost:8001/api/auth/
AUTHINATOR_VERIFY_SSL=False
```

## API

All endpoints are under `/api/fulfil/` and require JWT authentication via Authinator (except the health check).

```
GET  /api/fulfil/health/                       # Health check (no auth)
CRUD /api/fulfil/items/                        # Item catalog
CRUD /api/fulfil/purchase-orders/              # Purchase orders
POST /api/fulfil/purchase-orders/:id/close/    # Close PO
POST /api/fulfil/purchase-orders/:id/waive/    # Waive quantity
CRUD /api/fulfil/orders/                       # Orders
POST /api/fulfil/orders/:id/close/             # Close order
CRUD /api/fulfil/deliveries/                   # Deliveries
POST /api/fulfil/deliveries/:id/close/         # Close delivery
GET  /api/fulfil/deliveries/serial-search/?q=  # Serial lookup
GET  /api/fulfil/dashboard/                    # Dashboard metrics
```

## Contributing

This project follows TDD principles. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

Proprietary — Sighthound
