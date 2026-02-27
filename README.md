# FULFILinator

Order fulfillment tracking system for managing Purchase Orders, Orders, and Deliveries.

## Architecture

FULFILinator is part of a microservices architecture:
- **Authinator** (Port 8001): Centralized authentication service
- **RMAinator** (Port 8002): RMA tracking service
- **FULFILinator** (Port 8003): Order fulfillment tracking service

## Quick Start

### Development Setup (Local)

```bash
# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Run development server
python manage.py runserver 8003
```

## Testing

### Run All Tests

```bash
cd backend
pytest
```

### Run Tests Without Coverage

```bash
pytest --no-cov
```

### Run Specific Test File

```bash
pytest core/test_authentication.py -v
```

### Run Tests with Verbose Output

```bash
pytest -v
```

### View Coverage Report

After running tests, open `htmlcov/index.html` in your browser.

## API Endpoints

### Health Check
- `GET /api/fulfil/health/` - Service health check (no auth required)

### Authentication
All endpoints (except health check) require JWT authentication via Authinator.

**Authorization Header:**
```
Authorization: Bearer <jwt_token>
```

## Project Structure

```
FULFILinator/
├── backend/
│   ├── config/              # Django settings & URLs
│   ├── core/                # Authentication, permissions, utilities
│   │   ├── authinator_client.py    # Authinator API client
│   │   ├── authentication.py       # JWT authentication
│   │   ├── permissions.py          # RBAC permissions
│   │   └── views.py               # Health check
│   ├── items/               # Item catalog
│   ├── purchase_orders/     # PO management
│   ├── orders/              # Order management
│   ├── deliveries/          # Delivery tracking
│   ├── notifications/       # Email notifications
│   └── dashboard/           # Metrics & analytics
└── README.md               # This file
```

## User Roles

- **SYSTEM_ADMIN**: Full access to all data and features
- **CUSTOMER_ADMIN**: Manage users and data for their customer
- **CUSTOMER_USER**: View and edit their customer's data
- **CUSTOMER_READONLY**: View-only access to their customer's data

## Development Status

### ✅ Completed (Subphase 2.1)
- Django project setup with 7 apps
- Authinator integration (JWT validation)
- Role-based access control (RBAC)
- Permission system with customer data isolation
- Health check endpoint
- 39 tests with 92.57% coverage

### 🚧 In Progress
- Subphase 2.2: Item catalog
- Subphase 2.3: Purchase order management

### 📋 Planned
- Subphase 2.4: Order management
- Subphase 2.5: Delivery tracking
- Phase 3: Advanced features (search, dashboard, notifications)

## Environment Variables

Create a `.env` file in the `backend` directory:

```env
DEBUG=True
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1
AUTHINATOR_API_URL=http://localhost:8001/api/auth/
AUTHINATOR_VERIFY_SSL=False
```

## Contributing

This project follows Deft TDD principles:
1. Write tests first
2. Implement features
3. Maintain 80%+ code coverage
4. All tests must pass before moving to next phase

## Testing with Authinator

To test cross-service authentication:

1. Start Authinator service
2. Create a user in Authinator and get a JWT token
3. Use the token to access FULFILinator endpoints

Example:
```bash
# Login to Authinator
curl -X POST http://localhost:8001/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'

# Use the returned token
curl http://localhost:8003/api/fulfil/health/ \
  -H "Authorization: Bearer <access_token>"
```

## License

Proprietary - Sighthound
