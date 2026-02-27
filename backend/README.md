# FULFILinator

**Order Fulfillment Tracking System**

FULFILinator is a microservice for managing Purchase Orders, Orders, and Deliveries with complete fulfillment visibility. It provides tracking of item allocation from POs to Orders to Deliveries, including serial number management and email notifications.

## Features

- **Purchase Order Management**: Track POs with line items, fulfillment status, and expiration dates
- **Order Management**: Create Orders with automatic PO allocation using oldest-first algorithm
- **Delivery Management**: Track shipments with serial numbers and automatic Order fulfillment
- **Serial Number Tracking**: Unique serial number validation and search
- **Email Notifications**: Automated emails for key events (shipments, expiring POs, ready-to-close alerts)
- **Admin Overrides**: Allow admins to override validation with audit trail
- **Role-Based Access Control**: Integration with Authinator for authentication and permissions
- **Dashboard**: Metrics and alerts for system administrators
- **API Documentation**: Auto-generated OpenAPI/Swagger docs

## Architecture

FULFILinator follows the "inator microservice philosophy":
- Single-purpose service focused on fulfillment tracking
- RESTful API built with Django REST Framework
- JWT authentication via Authinator service
- Simple, focused deployment

### Apps

- `core`: Authentication, permissions, attachments, admin overrides
- `items`: Item catalog with pricing and SKU management
- `purchase_orders`: PO management with fulfillment tracking
- `orders`: Order management with PO allocation
- `deliveries`: Delivery management with serial number tracking
- `notifications`: Email notifications for key events
- `dashboard`: Metrics and alerts API

## Requirements

- Python 3.11+
- Django 5.1+
- SQLite (default) or PostgreSQL/MySQL for production
- Authinator service (for authentication)

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd fulfilinator/backend
```

### 2. Create and activate virtual environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 5. Run migrations

```bash
python manage.py migrate
```

### 6. Create initial data (optional)

```bash
python manage.py loaddata initial_items.json
```

## Running Locally

### Start the development server

```bash
python manage.py runserver 8001
```

The API will be available at:
- Main API: http://localhost:8001/api/fulfil/
- Health Check: http://localhost:8001/api/fulfil/health/
- API Docs (Swagger): http://localhost:8001/api/fulfil/docs/
- API Docs (ReDoc): http://localhost:8001/api/fulfil/redoc/

### Check expiring POs (scheduled task)

```bash
# Check for POs expiring in next 30 days
python manage.py check_expiring_pos

# Check for POs expiring in next 7 days
python manage.py check_expiring_pos --days 7

# Check without sending emails (dry run)
python manage.py check_expiring_pos --no-email
```

## Running Tests

### Run all tests

```bash
pytest
```

### Run tests with coverage

```bash
pytest --cov=. --cov-report=term-missing
```

### Run specific test file

```bash
pytest core/tests.py
pytest purchase_orders/test_allocation.py
```

### Run specific test

```bash
pytest core/tests.py::TestAuthentication::test_valid_jwt
```

## API Overview

### Authentication

All API endpoints require JWT authentication via Authinator:

```bash
# Include JWT token in Authorization header
Authorization: Bearer <jwt_token>
```

### Main Endpoints

- **Items**: `/api/fulfil/items/`
- **Purchase Orders**: `/api/fulfil/purchase-orders/`
- **Orders**: `/api/fulfil/orders/`
- **Deliveries**: `/api/fulfil/deliveries/`
- **Attachments**: `/api/fulfil/attachments/`
- **Admin Overrides**: `/api/fulfil/admin-overrides/`
- **Dashboard**: `/api/fulfil/dashboard/metrics/`, `/api/fulfil/dashboard/alerts/`

### Example: Create Purchase Order

```bash
curl -X POST http://localhost:8001/api/fulfil/purchase-orders/ \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "po_number": "PO-2025-001",
    "customer_id": "CUST001",
    "po_date": "2025-01-15",
    "expiration_date": "2025-07-15",
    "line_items": [
      {
        "item_id": 1,
        "quantity_ordered": 100,
        "price_per_unit": "99.99"
      }
    ]
  }'
```

### Example: Create Order (with automatic PO allocation)

```bash
curl -X POST http://localhost:8001/api/fulfil/orders/ \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "order_number": "ORD-2025-001",
    "customer_id": "CUST001",
    "order_date": "2025-01-20",
    "line_items": [
      {
        "item_id": 1,
        "quantity": 50
      }
    ]
  }'
```

## Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `SECRET_KEY`: Django secret key (required)
- `DEBUG`: Enable debug mode (default: True)
- `ALLOWED_HOSTS`: Comma-separated list of allowed hosts
- `AUTHINATOR_API_URL`: URL of Authinator service
- `EMAIL_BACKEND`: Email backend (console for dev, SMTP for prod)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`: SMTP configuration

## Permissions

FULFILinator uses role-based permissions via Authinator:

- **System Admin**: Full access to all resources across all customers
- **Customer Admin**: Full access to their customer's resources
- **Customer User**: Read-only access to their customer's resources

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment instructions.

## License

[Add license information]
