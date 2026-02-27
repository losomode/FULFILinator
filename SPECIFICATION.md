# FULFILinator System - Complete Specification

**Generated**: 2026-02-22  
**Status**: Ready for Implementation  
**Note**: References to Docker, docker-compose, and container deployment in this document are outdated. The inator family no longer uses Docker. See `INATOR.md` for current architecture.

---

## Overview

FULFILinator is a multi-tenant web application for tracking Purchase Orders (POs), Orders, and Deliveries for camera/node sales. The system provides separate interfaces for system administrators (company employees who manage fulfillment) and customer users (who view their orders and track deliveries).

The system is designed to work alongside the existing RMAinator application, sharing authentication infrastructure while maintaining clear service boundaries. Together, these systems provide complete visibility into both the sales fulfillment process (FULFILinator) and the repair/return process (RMAinator).

**Core Purpose:**
- Track PO commitments from customers
- Manage Order fulfillment against POs (oldest-first allocation)
- Record Deliveries with serial number tracking
- Provide visibility into fulfillment status at all levels

**Out of Scope:**
- Invoice generation and financial accounting (handled separately)
- Payment processing and tracking
- Inventory management

**Technology Stack:**
- Backend: Python + Django + Django REST Framework
- Frontend: React (unified SPA)
- Database: SQLite (development), PostgreSQL (production)
- Authentication: JWT via Authinator microservice
- Deployment: Simple microservice deployment (Gunicorn + nginx)
- API: REST with JWT authentication

---

## Requirements

### Functional Requirements

#### Authentication & Authorization
- ! MUST implement SSO, 2FA, and WebAuthn via shared Authinator
- ! MUST support four user roles:
  - **System Admin**: Company employees who manage all data
  - **Customer Admin**: Customer employees who can invite/manage users for their company
  - **Customer User**: Customer employees who can view data and submit information
  - **Customer Read-Only**: Customer employees with view-only access
- ! MUST require admin approval before new users can access the system
- ! MUST use JWT tokens for API authentication
- ! MUST isolate data by Customer (users can only see their Customer's data)
- ! MUST allow Customer Admins to invite and manage users within their own Customer

#### Data Model: Customers and Users
- ! MUST implement Customer entity (represents a company/organization)
- ! MUST allow multiple Users to belong to one Customer (many-to-one relationship)
- ! MUST associate all POs, Orders, Deliveries with a Customer (not individual users)
- ! MUST track which User created/modified records (audit trail)
- ! MUST ensure all Users from same Customer see the same POs/Orders/Deliveries

#### Purchase Order (PO) Management
- ! MUST allow System Admins to create/edit/delete POs
- ! MUST associate each PO with exactly one Customer
- ! MUST require at least one Item type and quantity per PO
- ! MUST store price per Item type per PO (negotiated pricing)
- ! MUST support multiple Orders against one PO
- ~ SHOULD include PO start date (date signed/agreed) for record-keeping
- ~ SHOULD include PO expiration date (target fulfillment deadline)
- ~ SHOULD support file attachments (signed PO PDFs, etc.)
- ~ SHOULD support Google Doc URL reference
- ~ SHOULD support HubSpot URL/ID reference
- ! MUST track fulfillment status: Original quantities, Ordered quantities, Remaining quantities
- ! MUST calculate remaining quantities: PO qty - sum(Order line items from this PO)
- ! MUST allow closing only when all items delivered OR explicitly waived by admin
- ! MUST alert admins when PO is ready to close (dashboard + email)
- ! MUST alert admins when PO is expiring soon (30 days, dashboard + email)
- ! MUST remain editable even after closing (closed = status flag only)
- ! MUST allow deletion only if no Orders reference the PO

#### FULFILinator
- ! MUST allow System Admins to create/edit/delete Orders
- ! MUST associate each Order with exactly one Customer
- ? MAY create Orders without associated PO (ad-hoc orders for special cases)
- ! MUST create Orders with associated PO(s) using automatic oldest-first allocation
- ! MUST allocate Order quantities from oldest PO first (by start date)
- ! MUST create Order line items that reference specific PO line items
- ! MUST inherit pricing from PO line items (System Admins can override)
- ! MUST support multiple POs per Order (if single PO can't fulfill all items)
- ! MUST prevent over-fulfillment: cannot order more than available on PO (with admin override)
- ! MUST track fulfillment status: Original quantities, Delivered quantities, Remaining quantities
- ! MUST calculate remaining quantities: Order qty - sum(Delivery line items from this Order)
- ! MUST allow closing only when all items delivered OR explicitly waived by admin
- ! MUST alert admins when Order is ready to close (dashboard + email)
- ! MUST remain editable even after closing
- ! MUST allow deletion only if no Deliveries reference the Order
- ! MUST update all referenced POs when Order is modified or closed

#### Delivery Management
- ! MUST allow System Admins to create/edit/delete Deliveries
- ! MUST link each Delivery to at least one Order
- ? MAY apply one Delivery to multiple Orders (same Customer only)
- ⊗ MUST NOT apply Delivery to multiple Customers
- ! MUST include ship date
- ! MUST include tracking number
- ! MUST include serial number per individual Item (one row per physical item)
- ! MUST require serial numbers at Delivery creation time
- ! MUST enforce unique serial numbers across all Deliveries
- ! MUST create Delivery line items that reference specific Order line items
- ! MUST use oldest-first fulfillment: fulfill oldest Order line items first
- ! MUST inherit pricing from Order line items (System Admins can override)
- ! MUST update all referenced Orders when Delivery is closed
- ! MUST allow closing when delivery is complete
- ! MUST remain editable even after closing
- ! MUST allow deletion only if admin confirms

#### Item Management
- ! MUST maintain Item catalog with: Name, Version, Description, MSRP, Minimum Price
- ! MUST use flat Item list (variants are separate Items)
- ! MUST allow System Admins to create/edit Items
- ! MUST track MSRP (list price) and Minimum Price per Item (reference only, not enforced)
- ! MUST allow quantity-based inclusion on POs and Orders
- ! MUST list Items individually on Deliveries (one row per serial number)

#### Fulfillment Visibility
- ! MUST display fulfillment status at PO level:
  - Original quantities per Item type
  - Which Orders have fulfilled from this PO (with links)
  - Quantities ordered per Item type
  - Remaining quantities per Item type
- ! MUST display fulfillment status at Order level:
  - Original quantities per Item type
  - Which Deliveries have fulfilled this Order (with links)
  - Quantities delivered per Item type
  - Remaining quantities per Item type
- ! MUST display complete Delivery details:
  - Which Orders this Delivery fulfills (with links)
  - Serial numbers for each Item
  - Ship date and tracking number

#### Admin Features
- ! MUST provide comprehensive search across POs, Orders, Deliveries:
  - Search by: Number/ID, Customer name, Item types, date ranges, status
  - Search serial numbers to find specific Deliveries
- ! MUST support multi-criteria filtering:
  - Filter by: Customer, Status (Open/Closed), Date Range, Item Type
  - Can combine multiple filters simultaneously
- ! MUST provide predefined quick views:
  - "Open POs", "POs Expiring Soon", "Orders In Progress", "Recent Deliveries"
- ~ SHOULD allow admins to save custom filter combinations
- ! MUST provide comprehensive dashboard with metrics:
  - **PO Metrics**: Total open POs, expiring soon, ready to close
  - **Order Metrics**: Active orders, ready to close
  - **Delivery Metrics**: Recent deliveries, items shipped this month
  - **Customer Metrics**: Total active customers, pending registrations
  - **Fulfillment Status**: Overall fulfillment rate, items on order vs delivered
- ! MUST filter dashboard by role (System Admins see all, Customer Admins see their Customer)

#### User Registration and Approval
- ! MUST implement registration flow similar to RMAinator:
  1. User registers with email/password and company information
  2. Account created but inactive
  3. System Admin approves or rejects with reason
  4. User receives email notification when approved
- ! MUST allow Customer Admins to invite users to their Customer
- ! MUST send email to admins when new user registration is pending

#### Email Notifications
- ! MUST send email notifications to customers (all users from Customer):
  - Delivery shipped (with tracking number and serial numbers)
- ! MUST send email notifications to admins:
  - PO ready to close (all items delivered/waived)
  - Order ready to close (all items delivered/waived)
  - PO expiring soon (30 days out)
  - New user registration pending approval
- ! MUST use email templates consistent with RMAinator

#### Validation and Business Rules
- ! MUST validate all inputs with warnings/errors
- ! MUST enforce strict validation rules:
  - Quantities must be positive integers
  - Prices should be between Item's minimum and MSRP (warning if outside)
  - Dates must be logical (expiration after start, delivery after order)
  - Serial numbers must be unique across all Deliveries
  - Cannot over-fulfill POs (Order qty exceeds remaining PO qty)
- ! MUST allow System Admins to override any validation warning
- ! MUST log all admin overrides for visibility
- ! MUST show clear warning messages before override

#### Attachments and References
- ! MUST support file attachments on POs, Orders, and Deliveries
- ! MUST support common file types: PDF, images, Excel files
- ! MUST store Google Doc URL per PO/Order (optional)
- ! MUST store HubSpot URL/ID per PO (optional)
- ~ SHOULD display attachment previews where possible
- ~ SHOULD reuse RMAinator's attachment handling implementation

### Non-Functional Requirements

#### Performance
- ~ SHOULD load dashboard with <1000 POs/Orders in under 2 seconds
- ~ SHOULD support pagination for large lists (50 items per page)
- ~ SHOULD index database columns used for searching (IDs, Customer, dates, serial numbers)

#### Security
- ! MUST hash passwords using Django's default password hasher
- ! MUST validate JWT tokens on all API endpoints
- ! MUST enforce role-based access control on all endpoints
- ! MUST prevent users from accessing other Customers' data
- ! MUST sanitize file uploads (type checking, size limits)
- ! MUST use HTTPS in production
- ~ SHOULD implement rate limiting on API endpoints

#### Scalability
- ~ SHOULD design for 100+ Customers, 1000+ Users, 10,000+ POs
- ~ SHOULD support SQLite for development and small deployments
- ? MAY support PostgreSQL migration path for larger deployments

#### Reliability
- ! MUST handle email sending failures gracefully (log and retry)
- ! MUST validate all user inputs with clear error messages
- ! MUST provide meaningful error messages to users
- ~ SHOULD log all errors for debugging

#### Testing
- ! MUST include comprehensive test suite:
  - Unit tests for models, business logic, validations
  - Integration tests for API endpoints, database operations
  - End-to-end tests for critical flows (PO → Order → Delivery)
- ! MUST achieve 80%+ code coverage
- ! MUST run tests in CI/CD pipeline

---

## Architecture

### System Architecture

```
                    ┌─────────────────────────┐
                    │   nginx API Gateway     │
                    │      (Port 80/443)      │
                    └────────────┬────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
    ┌───────▼────────┐  ┌────────▼────────┐  ┌──────▼──────────┐
    │  Authinator  │  │   RMAinator     │  │ FULFILinator │
    │   (Port 8001)  │  │   (Port 8002)   │  │   (Port 8003)   │
    │                │  │                 │  │                 │
    │  Django + DRF  │  │  Django + DRF   │  │  Django + DRF   │
    └───────┬────────┘  └────────┬────────┘  └────────┬────────┘
            │                    │                     │
    ┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
    │   Auth DB      │  │  RMAinator DB   │  │FULFILinator  │
    │   (SQLite)     │  │    (SQLite)     │  │   DB (SQLite)   │
    └────────────────┘  └─────────────────┘  └─────────────────┘
                                 
    ┌─────────────────────────────────────────────────────────┐
    │           Unified React Frontend (SPA)                  │
    │  Navigation: Orders | RMAs | Profile | Admin (if role) │
    └─────────────────────────────────────────────────────────┘
```

### Service Communication

**API Gateway Routing (nginx):**
- `app.company.com/api/auth/*` → Authinator (port 8001)
- `app.company.com/api/rma/*` → RMAinator (port 8002)
- `app.company.com/api/fulfil/*` → FULFILinator (port 8003)
- `app.company.com/*` → Frontend (static files)

**Service Independence:**
- Services communicate via REST APIs only (no direct database access)
- JWT tokens issued by Authinator, validated by all services
- Each service has its own database

### Component Architecture

#### Authinator (Extracted from RMAinator)

**Purpose:** Centralized authentication and user management for all services

**Django Apps:**
- `auth_core` - User authentication, JWT tokens
- `users` - User and Customer models, registration, approval
- `sso` - SSO providers (Google, Microsoft)
- `mfa` - 2FA (TOTP) and WebAuthn (Touch ID, hardware keys)

**Key Models:**
- `Customer` - Company/organization (name, contact info, billing address)
- `User` (extends Django AbstractUser) - User accounts with role and Customer FK
- `UserInvitation` - Pending user invites from Customer Admins
- `WebAuthnCredential` - Security keys per user
- `TOTPDevice` - 2FA devices per user

**API Endpoints:**
- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - JWT token generation
- `POST /api/auth/refresh/` - JWT token refresh
- `POST /api/auth/logout/` - Invalidate token
- `GET /api/auth/me/` - Current user info
- `POST /api/auth/2fa/enable/` - Enable 2FA
- `POST /api/auth/2fa/verify/` - Verify 2FA code
- `POST /api/auth/webauthn/register/` - Register security key
- `POST /api/auth/webauthn/authenticate/` - Authenticate with security key
- `GET /api/users/` - List users (filtered by role/customer)
- `GET /api/users/pending/` - List pending user approvals (admin)
- `POST /api/users/{id}/approve/` - Approve user (admin)
- `POST /api/users/{id}/reject/` - Reject user (admin)
- `POST /api/users/invite/` - Invite user to Customer (Customer Admin)
- `GET /api/customers/` - List customers (admin only)
- `GET /api/customers/{id}/` - Get customer details

#### FULFILinator Service

**Purpose:** Track POs, Orders, and Deliveries with fulfillment visibility

**Django Apps:**
- `core` - Common utilities, permissions
- `items` - Item catalog
- `purchase_orders` - PO management
- `orders` - Order management
- `deliveries` - Delivery management with serial numbers
- `notifications` - Email alerts
- `dashboard` - Metrics and analytics

**Key Models:**

```python
# Customer and User references come from Authinator (via API)

class Item(models.Model):
    name = CharField()  # "Camera LR", "Node 4.6 GA"
    version = CharField()
    description = TextField()
    msrp = DecimalField()  # List price (reference)
    min_price = DecimalField()  # Minimum price (reference)
    created_at = DateTimeField()
    created_by_user_id = IntegerField()  # Authinator user ID

class PurchaseOrder(models.Model):
    po_number = CharField(unique=True, auto-generated)
    customer_id = IntegerField()  # Authinator customer ID
    start_date = DateField(null=True)  # Date signed
    expiration_date = DateField(null=True)  # Target deadline
    status = CharField(choices=['OPEN', 'CLOSED'])
    notes = TextField()
    google_doc_url = URLField(null=True)
    hubspot_url = URLField(null=True)
    created_at = DateTimeField()
    created_by_user_id = IntegerField()
    closed_at = DateTimeField(null=True)
    closed_by_user_id = IntegerField(null=True)

class POLineItem(models.Model):
    po = ForeignKey(PurchaseOrder)
    item = ForeignKey(Item)
    quantity = IntegerField()
    price_per_unit = DecimalField()  # Negotiated price
    notes = TextField()

class Order(models.Model):
    order_number = CharField(unique=True, auto-generated)
    customer_id = IntegerField()  # Authinator customer ID
    status = CharField(choices=['OPEN', 'CLOSED'])
    notes = TextField()
    created_at = DateTimeField()
    created_by_user_id = IntegerField()
    closed_at = DateTimeField(null=True)
    closed_by_user_id = IntegerField(null=True)

class OrderLineItem(models.Model):
    order = ForeignKey(Order)
    item = ForeignKey(Item)
    quantity = IntegerField()
    price_per_unit = DecimalField()  # From PO or overridden
    po_line_item = ForeignKey(POLineItem, null=True)  # Null for ad-hoc
    notes = TextField()
    override_reason = TextField(null=True)  # If price overridden

class Delivery(models.Model):
    delivery_number = CharField(unique=True, auto-generated)
    customer_id = IntegerField()  # Authinator customer ID
    ship_date = DateField()
    tracking_number = CharField()
    status = CharField(choices=['OPEN', 'CLOSED'])
    notes = TextField()
    created_at = DateTimeField()
    created_by_user_id = IntegerField()
    closed_at = DateTimeField(null=True)
    closed_by_user_id = IntegerField(null=True)

class DeliveryLineItem(models.Model):
    delivery = ForeignKey(Delivery)
    item = ForeignKey(Item)
    serial_number = CharField(unique=True)  # One row per physical item
    price_per_unit = DecimalField()  # From Order or overridden
    order_line_item = ForeignKey(OrderLineItem)  # Which order this fulfills
    notes = TextField()
    override_reason = TextField(null=True)  # If price overridden

class Attachment(models.Model):
    content_type = CharField()  # 'PO', 'Order', 'Delivery'
    object_id = IntegerField()  # PO/Order/Delivery ID
    file = FileField()
    filename = CharField()
    uploaded_at = DateTimeField()
    uploaded_by_user_id = IntegerField()

class AdminOverride(models.Model):
    # Log all validation overrides
    user_id = IntegerField()
    action = CharField()  # 'over_fulfill_po', 'price_below_min', etc.
    details = JSONField()
    created_at = DateTimeField()

class SavedFilter(models.Model):
    user_id = IntegerField()
    name = CharField()
    filter_type = CharField()  # 'PO', 'Order', 'Delivery'
    filter_params = JSONField()
    is_predefined = BooleanField(default=False)
```

**API Endpoints:**

*Items:*
- `GET /api/fulfil/items/` - List items
- `POST /api/fulfil/items/` - Create item (admin)
- `GET /api/fulfil/items/{id}/` - Get item details
- `PUT /api/fulfil/items/{id}/` - Update item (admin)
- `DELETE /api/fulfil/items/{id}/` - Delete item (admin)

*Purchase Orders:*
- `GET /api/fulfil/pos/` - List POs (filtered by customer/role)
- `POST /api/fulfil/pos/` - Create PO (admin)
- `GET /api/fulfil/pos/{id}/` - Get PO with line items and fulfillment status
- `PUT /api/fulfil/pos/{id}/` - Update PO (admin)
- `DELETE /api/fulfil/pos/{id}/` - Delete PO if no orders (admin)
- `POST /api/fulfil/pos/{id}/close/` - Close PO (admin)
- `POST /api/fulfil/pos/{id}/waive-items/` - Waive remaining items (admin)
- `GET /api/fulfil/pos/{id}/fulfillment/` - Get detailed fulfillment breakdown
- `GET /api/fulfil/pos/{id}/attachments/` - List attachments
- `POST /api/fulfil/pos/{id}/attachments/` - Upload attachment

*Orders:*
- `GET /api/fulfil/orders/` - List orders (filtered by customer/role)
- `POST /api/fulfil/orders/` - Create order with automatic PO allocation (admin)
- `GET /api/fulfil/orders/{id}/` - Get order with line items and fulfillment status
- `PUT /api/fulfil/orders/{id}/` - Update order (admin)
- `DELETE /api/fulfil/orders/{id}/` - Delete order if no deliveries (admin)
- `POST /api/fulfil/orders/{id}/close/` - Close order (admin)
- `POST /api/fulfil/orders/{id}/waive-items/` - Waive remaining items (admin)
- `GET /api/fulfil/orders/{id}/fulfillment/` - Get detailed fulfillment breakdown
- `GET /api/fulfil/orders/{id}/attachments/` - List attachments
- `POST /api/fulfil/orders/{id}/attachments/` - Upload attachment

*Deliveries:*
- `GET /api/fulfil/deliveries/` - List deliveries (filtered by customer/role)
- `POST /api/fulfil/deliveries/` - Create delivery (admin)
- `GET /api/fulfil/deliveries/{id}/` - Get delivery with line items
- `PUT /api/fulfil/deliveries/{id}/` - Update delivery (admin)
- `DELETE /api/fulfil/deliveries/{id}/` - Delete delivery (admin)
- `POST /api/fulfil/deliveries/{id}/close/` - Close delivery (admin)
- `GET /api/fulfil/deliveries/search-serial/` - Search by serial number

*Search & Filters:*
- `GET /api/fulfil/search/` - Global search across POs/Orders/Deliveries
- `GET /api/fulfil/filters/saved/` - List user's saved filters
- `POST /api/fulfil/filters/saved/` - Save filter
- `DELETE /api/fulfil/filters/saved/{id}/` - Delete saved filter

*Dashboard:*
- `GET /api/fulfil/dashboard/metrics/` - Get dashboard metrics (filtered by role)
- `GET /api/fulfil/dashboard/alerts/` - Get actionable alerts

#### Unified React Frontend

**Purpose:** Single-page application providing seamless navigation between Orders and RMAs

**Directory Structure:**
```
frontend/
  src/
    auth/          - Login, registration, profile, 2FA, WebAuthn
    common/        - Shared components (Layout, Navigation, Tables, Forms)
    orders/        - FULFILinator features
      pos/         - PO list, detail, create, edit
      orders/      - Order list, detail, create, edit
      deliveries/  - Delivery list, detail, create, edit
      items/       - Item catalog
      dashboard/   - Admin dashboard
      search/      - Search and filters
    rma/           - RMAinator features (existing)
    api/           - API client utilities
    hooks/         - Custom React hooks
    utils/         - Helper functions
```

**Key Features:**
- Shared navigation bar with: Orders | RMAs | Profile | Admin Dashboard (if admin)
- Consistent UI patterns (tables, forms, modals)
- Shared components from component library
- Role-based rendering (hide admin features for customers)
- Responsive design

**Authentication Flow:**
1. User logs in via Authinator
2. Receives JWT token (stored in localStorage)
3. Token included in all API requests to all services
4. Frontend checks user role and shows/hides features accordingly

---

## Implementation Plan

### Overview

The implementation is broken into **5 phases**, each with multiple subphases. Each phase/subphase must complete with passing tests before moving to the next. The plan is designed to:
1. Extract and establish shared Authinator first (foundation)
2. Build FULFILinator incrementally (POs → Orders → Deliveries)
3. Add advanced features (search, dashboard, notifications)
4. Integrate and polish

**Parallel Work:** Multiple agents/developers can work in parallel on different subphases marked as **(can parallelize)**.

---

### Phase 1: Foundation - Shared Authinator

**Goal:** Extract authentication from RMAinator into standalone Authinator with Customer/User model

#### Subphase 1.1: Authinator Setup

**Tasks:**

**1.1.1: Create Authinator Django Project**
- Initialize new Django project: `authinator`
- Configure Django REST Framework
- Set up project structure (apps: auth_core, users, sso, mfa)
- Configure SQLite database
- Create Docker container configuration
- **Dependencies:** None
- **Acceptance Criteria:**
  - Django app runs and responds to health check
  - Database migrations run successfully
  - Docker container builds and starts

**1.1.2: Extract User and Customer Models**
- Create Customer model (name, contact info, billing address)
- Create User model extending AbstractUser (add customer FK, role field)
- Define roles: SYSTEM_ADMIN, CUSTOMER_ADMIN, CUSTOMER_USER, CUSTOMER_READONLY
- Create database migrations
- **Dependencies:** 1.1.1
- **Acceptance Criteria:**
  - Models create without errors
  - Can create Customer and User via Django shell
  - User roles validated correctly

**1.1.3: Implement JWT Authentication**
- Install djangorestframework-simplejwt
- Configure JWT settings (token expiration, refresh)
- Create login endpoint: POST /api/auth/login/
- Create refresh endpoint: POST /api/auth/refresh/
- Create logout endpoint (token blacklisting)
- **Dependencies:** 1.1.2
- **Acceptance Criteria:**
  - User can login and receive access + refresh tokens
  - Tokens can be refreshed
  - Invalid tokens are rejected
  - Unit tests pass (80%+ coverage)

**1.1.4: Implement Registration and Approval Flow**
- Create registration endpoint: POST /api/auth/register/
- Create user approval endpoints: GET /api/users/pending/, POST /api/users/{id}/approve/
- Implement approval workflow (user inactive until approved)
- Add email notification on approval
- **Dependencies:** 1.1.3
- **Acceptance Criteria:**
  - User can register (account created but inactive)
  - Admin can see pending users
  - Admin can approve/reject users
  - Approved user can login
  - Email sent on approval
  - Unit and integration tests pass

**Testing Requirements for Subphase 1.1:**
- Unit tests for models (Customer, User, roles)
- Integration tests for registration and approval flow
- API endpoint tests (login, register, approve)
- Test coverage: 80%+

#### Subphase 1.2: SSO and MFA Support (depends on: 1.1)

**Tasks:**

**1.2.1: Extract and Adapt SSO Implementation from RMAinator**
- Copy SSO implementation from RMAinator
- Adapt for Authinator
- Configure OAuth providers (Google, Microsoft)
- Create SSO endpoints
- **Dependencies:** 1.1.4
- **Acceptance Criteria:**
  - User can login via Google SSO
  - User can login via Microsoft SSO
  - SSO user accounts created automatically
  - Integration tests pass

**1.2.2: Extract and Adapt 2FA/WebAuthn from RMAinator**
- Copy 2FA (TOTP) implementation from RMAinator
- Copy WebAuthn implementation from RMAinator
- Adapt for Authinator
- Create 2FA/WebAuthn endpoints
- **Dependencies:** 1.1.4
- **Acceptance Criteria:**
  - User can enable TOTP 2FA
  - User can register WebAuthn credential (Touch ID, hardware key)
  - Login requires 2FA if enabled
  - Integration tests pass

**1.2.3: Implement Customer Admin User Invitation**
- Create invitation model and endpoints
- Allow Customer Admins to invite users to their Customer
- Send invitation email with registration link
- **Dependencies:** 1.1.4
- **Acceptance Criteria:**
  - Customer Admin can invite users
  - Invited user receives email
  - Invited user can register and join correct Customer
  - Unit and integration tests pass

**Testing Requirements for Subphase 1.2:**
- Integration tests for SSO login flows
- Integration tests for 2FA and WebAuthn
- Unit tests for invitation logic
- E2E tests for complete registration flows
- Test coverage: 80%+

#### Subphase 1.3: Authinator Deployment (depends on: 1.2)

**Tasks:**

**1.3.1: Configure nginx API Gateway**
- Create nginx configuration
- Set up routing: /api/auth/* → Authinator
- Configure CORS headers
- Configure SSL/TLS (development certs)
- **Dependencies:** 1.2.3
- **Acceptance Criteria:**
  - nginx routes requests correctly
  - CORS configured properly
  - Can access Auth API via gateway

**1.3.2: Create Docker Compose Configuration**
- Create docker-compose.yml for all services
- Configure Authinator container
- Configure nginx container
- Configure shared network
- Add volume mounts for development
- **Dependencies:** 1.3.1
- **Acceptance Criteria:**
  - All containers start with docker-compose up
  - Services can communicate
  - Databases persist data

**1.3.3: Integration Testing with RMAinator**
- Update RMAinator to use Authinator for authentication
- Test that RMAinator can validate JWT tokens from Authinator
- Verify user roles work across services
- **Dependencies:** 1.3.2
- **Acceptance Criteria:**
  - RMAinator validates tokens from Authinator
  - RMAinator users can authenticate via Authinator
  - Role-based access control works
  - Integration tests pass

**Testing Requirements for Subphase 1.3:**
- Integration tests for service communication
- E2E tests for cross-service authentication
- Load testing for Authinator (basic)
- Test coverage: 80%+

---

### Phase 2: FULFILinator Core - Items and POs (depends on: Phase 1)

**Goal:** Implement Item catalog and Purchase Order management

#### Subphase 2.1: FULFILinator Service Setup (can parallelize with 1.3)

**Tasks:**

**2.1.1: Create FULFILinator Django Project**
- Initialize new Django project: `FULFILinator`
- Configure Django REST Framework
- Set up project structure (apps: core, items, purchase_orders, orders, deliveries, notifications, dashboard)
- Configure SQLite database
- Create Docker container configuration
- **Dependencies:** 1.2.3 (can start in parallel)
- **Acceptance Criteria:**
  - Django app runs and responds to health check
  - Database migrations run successfully
  - Docker container builds and starts

**2.1.2: Implement Permission System with Authinator Integration**
- Create permission classes for role-based access control
- Implement JWT token validation (verify tokens from Authinator)
- Create middleware to fetch user/customer from Authinator
- Implement data isolation by Customer
- **Dependencies:** 2.1.1, 1.3.3
- **Acceptance Criteria:**
  - Can validate JWT tokens from Authinator
  - Can fetch user role and customer ID from Authinator
  - Permission classes enforce role-based access
  - Data filtered by customer for non-admins
  - Unit tests pass

**2.1.3: Add FULFILinator to Docker Compose**
- Add FULFILinator service to docker-compose.yml
- Configure nginx routing: /api/fulfil/* → FULFILinator
- Test service communication
- **Dependencies:** 2.1.2, 1.3.2
- **Acceptance Criteria:**
  - FULFILinator accessible via nginx gateway
  - Can authenticate using Authinator tokens
  - Integration tests pass

**Testing Requirements for Subphase 2.1:**
- Unit tests for permission classes
- Integration tests for JWT validation
- Integration tests for cross-service communication
- Test coverage: 80%+

#### Subphase 2.2: Item Catalog (depends on: 2.1)

**Tasks:**

**2.2.1: Create Item Model and API**
- Implement Item model (name, version, description, MSRP, min_price)
- Create serializers
- Create API endpoints (CRUD)
- Implement admin-only permissions for create/edit/delete
- **Dependencies:** 2.1.3
- **Acceptance Criteria:**
  - System Admins can create/edit Items
  - All users can view Items
  - Items have MSRP and min_price
  - API tests pass

**2.2.2: Create Item Management UI**
- Create React components for Item list
- Create React components for Item create/edit forms
- Implement search and filtering
- **Dependencies:** 2.2.1
- **Acceptance Criteria:**
  - Admins can view/create/edit Items via UI
  - Item list displays with pagination
  - Search works
  - UI tests pass

**Testing Requirements for Subphase 2.2:**
- Unit tests for Item model
- API endpoint tests
- React component tests
- E2E test for Item CRUD flow
- Test coverage: 80%+

#### Subphase 2.3: Purchase FULFILinator (depends on: 2.2)

**Tasks:**

**2.3.1: Create PO and POLineItem Models**
- Implement PurchaseOrder model
- Implement POLineItem model (with Item FK, quantity, price_per_unit)
- Add auto-generated PO number
- Add status (OPEN/CLOSED), dates, references
- Create database migrations
- **Dependencies:** 2.2.2
- **Acceptance Criteria:**
  - Can create POs with line items
  - PO numbers auto-generated
  - Relationships work correctly
  - Model tests pass

**2.3.2: Implement PO API Endpoints**
- Create serializers for PO and POLineItem
- Implement CRUD endpoints for POs
- Implement fulfillment status calculation (remaining = PO qty - sum(Order qty))
- Implement close/waive endpoints
- Add validation (admin overrides)
- **Dependencies:** 2.3.1
- **Acceptance Criteria:**
  - System Admins can create/edit/delete POs
  - Customers can view their POs
  - Fulfillment status calculated correctly
  - Cannot over-fulfill (with override)
  - API tests pass

**2.3.3: Implement Attachment Support**
- Create Attachment model (generic for PO/Order/Delivery)
- Implement file upload endpoints
- Configure file storage
- Add file type and size validation
- **Dependencies:** 2.3.1
- **Acceptance Criteria:**
  - Can upload files to POs
  - Files stored securely
  - Can download attachments
  - Validation works (file types, sizes)
  - API tests pass

**2.3.4: Create PO Management UI**
- Create PO list view (with search/filters)
- Create PO detail view (with fulfillment status)
- Create PO create/edit forms (with line items)
- Implement file upload UI
- Add Google Doc and HubSpot URL fields
- **Dependencies:** 2.3.2, 2.3.3
- **Acceptance Criteria:**
  - Admins can create/edit POs via UI
  - PO detail shows fulfillment breakdown
  - Can add/remove line items dynamically
  - Can upload attachments
  - Customers can view their POs (read-only)
  - UI tests pass

**Testing Requirements for Subphase 2.3:**
- Unit tests for PO models
- Unit tests for fulfillment calculations
- API endpoint tests (CRUD, close, waive)
- Integration tests for attachment upload
- React component tests
- E2E test for PO creation and fulfillment display
- Test coverage: 80%+

---

### Phase 3: FULFILinator Core - Orders and Deliveries (depends on: Phase 2)

**Goal:** Implement Order and Delivery management with fulfillment logic

#### Subphase 3.1: FULFILinator (depends on: 2.3)

**Tasks:**

**3.1.1: Create Order and OrderLineItem Models**
- Implement Order model
- Implement OrderLineItem model (with Item FK, quantity, price, PO line item FK)
- Add auto-generated Order number
- Add status, notes
- Create database migrations
- **Dependencies:** 2.3.4
- **Acceptance Criteria:**
  - Can create Orders with line items
  - Order numbers auto-generated
  - Order line items reference PO line items (optional)
  - Model tests pass

**3.1.2: Implement Oldest-First PO Allocation Logic**
- Create allocation algorithm: given items and quantities, allocate from oldest POs first
- Handle multi-PO allocation
- Handle ad-hoc orders (no PO reference)
- Validate against available PO quantities (with override)
- **Dependencies:** 3.1.1
- **Acceptance Criteria:**
  - Algorithm allocates from oldest PO first (by start_date)
  - Correctly spans multiple POs if needed
  - Validates quantity availability
  - Admin can override validation
  - Unit tests pass with multiple scenarios

**3.1.3: Implement Order API Endpoints**
- Create serializers for Order and OrderLineItem
- Implement CRUD endpoints
- Implement order creation with automatic PO allocation
- Implement fulfillment status calculation (remaining = Order qty - sum(Delivery qty))
- Implement close/waive endpoints
- Update referenced POs when Order changes
- **Dependencies:** 3.1.2
- **Acceptance Criteria:**
  - System Admins can create Orders
  - Order creation automatically allocates from POs
  - Can create ad-hoc Orders without PO
  - Fulfillment status calculated correctly
  - PO remaining quantities update when Order created/closed
  - API tests pass

**3.1.4: Create FULFILinator UI**
- Create Order list view (with search/filters)
- Create Order detail view (with fulfillment status and PO references)
- Create Order create/edit forms
- Show PO allocation during order creation
- Display which POs are being fulfilled
- **Dependencies:** 3.1.3
- **Acceptance Criteria:**
  - Admins can create/edit Orders via UI
  - Order creation shows PO allocation preview
  - Order detail shows fulfillment breakdown
  - Shows which POs this Order fulfills from
  - Customers can view their Orders (read-only)
  - UI tests pass

**Testing Requirements for Subphase 3.1:**
- Unit tests for Order models
- Unit tests for PO allocation algorithm (multiple scenarios)
- Unit tests for fulfillment calculations
- API endpoint tests
- Integration tests for PO updates on Order changes
- React component tests
- E2E test for Order creation with PO allocation
- Test coverage: 80%+

#### Subphase 3.2: Delivery Management (depends on: 3.1)

**Tasks:**

**3.2.1: Create Delivery and DeliveryLineItem Models**
- Implement Delivery model (ship_date, tracking_number, status)
- Implement DeliveryLineItem model (one row per Item with serial_number, Order line item FK)
- Add auto-generated Delivery number
- Add unique constraint on serial_number
- Create database migrations
- **Dependencies:** 3.1.4
- **Acceptance Criteria:**
  - Can create Deliveries with line items
  - Delivery numbers auto-generated
  - Each line item has unique serial number
  - Delivery line items reference Order line items
  - Model tests pass

**3.2.2: Implement Delivery Fulfillment Logic**
- Create logic to fulfill oldest Order line items first
- Support multi-Order Deliveries (same Customer)
- Validate serial number uniqueness
- Validate quantities against Order availability
- **Dependencies:** 3.2.1
- **Acceptance Criteria:**
  - Fulfills oldest Order line items first
  - Can create Delivery for multiple Orders (same Customer)
  - Cannot use duplicate serial numbers
  - Validates quantity availability (with override)
  - Unit tests pass

**3.2.3: Implement Delivery API Endpoints**
- Create serializers for Delivery and DeliveryLineItem
- Implement CRUD endpoints
- Implement search by serial number
- Update referenced Orders when Delivery created/closed
- Update referenced POs (via Orders)
- **Dependencies:** 3.2.2
- **Acceptance Criteria:**
  - System Admins can create Deliveries
  - Serial numbers validated for uniqueness
  - Order and PO fulfillment status updates on Delivery creation
  - Can search by serial number
  - API tests pass

**3.2.4: Create Delivery Management UI**
- Create Delivery list view (with search/filters)
- Create Delivery detail view (with serial numbers and Order references)
- Create Delivery create/edit forms (one row per item/serial number)
- Implement serial number entry (manual or CSV import)
- **Dependencies:** 3.2.3
- **Acceptance Criteria:**
  - Admins can create/edit Deliveries via UI
  - Can enter serial numbers individually or bulk
  - Delivery detail shows all serial numbers
  - Shows which Orders this Delivery fulfills
  - Customers can view their Deliveries (read-only)
  - Customers receive email when Delivery ships
  - UI tests pass

**Testing Requirements for Subphase 3.2:**
- Unit tests for Delivery models
- Unit tests for fulfillment logic
- API endpoint tests
- Integration tests for Order/PO updates
- React component tests
- E2E test for complete fulfillment flow: PO → Order → Delivery
- Test coverage: 80%+

---

### Phase 4: Advanced Features (depends on: Phase 3)

**Goal:** Add search, filtering, dashboard, notifications, and alerts

#### Subphase 4.1: Search and Filtering (can parallelize with 4.2)

**Tasks:**

**4.1.1: Implement Comprehensive Search Backend**
- Create search endpoints for POs, Orders, Deliveries
- Support search by: number, customer name, item types, serial numbers, dates
- Implement multi-criteria filtering
- Optimize with database indexes
- **Dependencies:** 3.2.4
- **Acceptance Criteria:**
  - Can search across all entities
  - Search by serial number finds correct Delivery
  - Multi-filter works (Customer + Status + Date Range)
  - Search is fast (<1 second for 1000+ records)
  - API tests pass

**4.1.2: Implement Saved Filters**
- Create SavedFilter model
- Implement API endpoints to save/load/delete filters
- Create predefined views (Open POs, Expiring POs, etc.)
- **Dependencies:** 4.1.1
- **Acceptance Criteria:**
  - Users can save custom filters
  - Predefined views available for all users
  - Filters persist across sessions
  - API tests pass

**4.1.3: Create Search and Filter UI**
- Create unified search bar (global search)
- Create filter sidebars for each entity type
- Implement saved filter UI (load/save/delete)
- Create predefined quick views
- **Dependencies:** 4.1.2
- **Acceptance Criteria:**
  - Global search works from any page
  - Filter UI is intuitive
  - Can combine multiple filters
  - Saved filters accessible from dropdown
  - UI tests pass

**Testing Requirements for Subphase 4.1:**
- Unit tests for search logic
- API tests for search endpoints
- Performance tests (search with 1000+ records)
- React component tests
- E2E test for search and filter workflows
- Test coverage: 80%+

#### Subphase 4.2: Admin Dashboard (can parallelize with 4.1)

**Tasks:**

**4.2.1: Implement Dashboard Metrics Backend**
- Create dashboard API endpoint
- Calculate metrics:
  - PO metrics (open, expiring, ready to close)
  - Order metrics (active, ready to close)
  - Delivery metrics (recent, items shipped)
  - Customer metrics (active, pending approvals)
  - Fulfillment rates
- Filter by role (System Admin sees all, Customer Admin sees their Customer)
- **Dependencies:** 3.2.4
- **Acceptance Criteria:**
  - Metrics calculated correctly
  - Metrics filtered by role
  - API response is fast (<1 second)
  - API tests pass

**4.2.2: Create Dashboard UI**
- Create dashboard page with metrics cards
- Create charts (orders over time, deliveries by customer, etc.)
- Display actionable alerts section (POs ready to close, expiring soon)
- Role-specific rendering
- **Dependencies:** 4.2.1
- **Acceptance Criteria:**
  - Dashboard displays all metrics
  - Charts render correctly
  - Alerts section shows actionable items
  - System Admins see all data
  - Customer Admins see only their Customer
  - UI tests pass

**Testing Requirements for Subphase 4.2:**
- Unit tests for metric calculations
- API tests for dashboard endpoint
- React component tests
- E2E test for dashboard access by different roles
- Test coverage: 80%+

#### Subphase 4.3: Email Notifications and Alerts (depends on: 4.2)

**Tasks:**

**4.3.1: Implement Email Notification System**
- Create email service (reuse RMAinator's implementation)
- Create email templates:
  - Delivery shipped (to customers with tracking and serial numbers)
  - PO ready to close (to admins)
  - Order ready to close (to admins)
  - PO expiring soon (to admins)
  - User registration pending (to admins)
- Configure email backend (SMTP)
- **Dependencies:** 4.2.2
- **Acceptance Criteria:**
  - Emails sent on correct triggers
  - Templates render correctly
  - All users from Customer receive customer emails
  - Only admins receive admin emails
  - Email sending failures logged and retried
  - Integration tests pass

**4.3.2: Implement Scheduled Alert Checks**
- Create management command to check for expiring POs (run daily)
- Create management command to check for POs/Orders ready to close
- Send alert emails
- Update dashboard with alerts
- **Dependencies:** 4.3.1
- **Acceptance Criteria:**
  - Scheduled jobs run successfully
  - Alert emails sent when conditions met
  - Dashboard alerts section updates
  - Integration tests pass

**4.3.3: Integrate Email Notifications into Workflows**
- Send email when Delivery is created (ship notification)
- Send email when PO/Order becomes ready to close
- Send email when user registration is pending
- **Dependencies:** 4.3.2
- **Acceptance Criteria:**
  - Emails sent at correct times
  - Email content is accurate and helpful
  - E2E tests include email verification

**Testing Requirements for Subphase 4.3:**
- Unit tests for email rendering
- Integration tests for email sending
- Integration tests for scheduled jobs
- E2E tests for complete notification flows
- Test coverage: 80%+

---

### Phase 5: Integration and Polish (depends on: Phase 4)

**Goal:** Integrate all services, polish UI, optimize performance, prepare for deployment

#### Subphase 5.1: UI/UX Polish and Consistency

**Tasks:**

**5.1.1: Unify UI Components and Styling**
- Ensure consistent styling across Orders and RMAs sections
- Create shared component library
- Implement responsive design for mobile/tablet
- Add loading states and error handling
- **Dependencies:** 4.3.3
- **Acceptance Criteria:**
  - UI looks consistent across all pages
  - Mobile/tablet views work correctly
  - Loading and error states display properly
  - UI component tests pass

**5.1.2: Improve Navigation and User Flows**
- Refine navigation between Orders and RMAs
- Add breadcrumbs and back buttons
- Improve form validation and error messages
- Add confirmation dialogs for destructive actions
- **Dependencies:** 5.1.1
- **Acceptance Criteria:**
  - Navigation is intuitive
  - Users can easily move between features
  - Error messages are clear and helpful
  - Confirmation dialogs prevent accidental deletions
  - Usability testing passes

**5.1.3: Add Helpful Tooltips and Documentation**
- Add tooltips for complex fields
- Create in-app help documentation
- Add "Getting Started" guide for new users
- **Dependencies:** 5.1.2
- **Acceptance Criteria:**
  - Tooltips explain fields clearly
  - Help documentation is accessible
  - New users can onboard easily

**Testing Requirements for Subphase 5.1:**
- UI component tests
- Accessibility tests
- Cross-browser testing
- Usability testing with real users

#### Subphase 5.2: Performance Optimization

**Tasks:**

**5.2.1: Optimize Database Queries**
- Add database indexes for search fields
- Optimize N+1 query problems (use select_related, prefetch_related)
- Add query caching where appropriate
- **Dependencies:** 5.1.3
- **Acceptance Criteria:**
  - Dashboard loads in <1 second with 1000+ POs
  - List views load quickly with pagination
  - No N+1 query problems
  - Performance tests pass

**5.2.2: Optimize Frontend Performance**
- Implement code splitting
- Lazy load components
- Optimize bundle size
- Add frontend caching
- **Dependencies:** 5.2.1
- **Acceptance Criteria:**
  - Initial page load is fast (<2 seconds)
  - Bundle size is optimized
  - Page transitions are smooth
  - Lighthouse performance score >90

**Testing Requirements for Subphase 5.2:**
- Performance tests (load testing)
- Database query analysis
- Frontend bundle analysis
- Lighthouse audits

#### Subphase 5.3: Production Readiness (depends on: 5.2)

**Tasks:**

**5.3.1: Security Hardening**
- Enable rate limiting on API endpoints
- Configure HTTPS with real SSL certificates
- Add CSRF protection
- Configure secure headers (CSP, HSTS, etc.)
- Audit dependencies for vulnerabilities
- **Dependencies:** 5.2.2
- **Acceptance Criteria:**
  - Rate limiting works
  - HTTPS configured correctly
  - Security headers set properly
  - No high-severity vulnerabilities
  - Security audit passes

**5.3.2: Logging and Monitoring**
- Configure structured logging for all services
- Set up error tracking (e.g., Sentry)
- Add health check endpoints
- Configure log rotation
- **Dependencies:** 5.3.1
- **Acceptance Criteria:**
  - Logs are structured and searchable
  - Errors tracked and alerted
  - Health checks respond correctly
  - Logs rotate to prevent disk fill

**5.3.3: Deployment Documentation**
- Write deployment guide
- Document environment variables
- Document backup/restore procedures
- Create runbook for common operations
- **Dependencies:** 5.3.2
- **Acceptance Criteria:**
  - Documentation is complete and accurate
  - Can deploy to production following guide
  - Backup/restore procedures tested

**5.3.4: Final Integration Testing**
- Run complete E2E test suite across all services
- Test all user flows from registration to delivery
- Test role-based access control thoroughly
- Perform load testing
- **Dependencies:** 5.3.3
- **Acceptance Criteria:**
  - All E2E tests pass
  - All user roles work correctly
  - System handles expected load
  - No critical bugs remain
  - Test coverage: 80%+

**Testing Requirements for Subphase 5.3:**
- Security testing (penetration testing)
- Load testing (expected concurrent users)
- E2E testing (all flows)
- Integration testing (all services)
- Smoke testing (production-like environment)

---

## Testing Strategy

### Unit Testing
- **Coverage Target:** 80%+ per service
- **Framework:** pytest for Django, Jest for React
- **Scope:**
  - Models and business logic
  - Serializers and validators
  - Permission classes
  - Utility functions
  - React components (isolated)

### Integration Testing
- **Framework:** pytest with Django test client
- **Scope:**
  - API endpoints (CRUD operations)
  - Service-to-service communication
  - Database operations
  - Email sending
  - File uploads

### End-to-End Testing
- **Framework:** Playwright or Cypress
- **Critical Flows to Test:**
  - User registration → approval → login
  - Create PO → Create Order → Create Delivery (complete fulfillment flow)
  - Search and filter across entities
  - Admin dashboard access and metrics
  - Email notifications triggered correctly
  - Role-based access control

### Performance Testing
- **Tools:** Locust or Apache JMeter
- **Scenarios:**
  - Dashboard load with 1000+ POs
  - Search with large dataset
  - Concurrent user logins
  - API endpoint response times

### Security Testing
- **Areas:**
  - Authentication and authorization
  - Role-based access control
  - Data isolation between customers
  - Input validation and sanitization
  - File upload security
  - CSRF and XSS protection

### Test Automation
- **CI/CD Pipeline:**
  - Run unit tests on every commit
  - Run integration tests on every PR
  - Run E2E tests before deployment
  - Block deployment if tests fail

---

## Deployment

### Development Environment

**Setup:**
```bash
# Clone repositories
git clone <authinator-repo>
git clone <rmainator-repo>
git clone <order-management-repo>
git clone <frontend-repo>

# Start all services
docker-compose up

# Services will be available at:
# - Frontend: http://localhost
# - Auth API: http://localhost/api/auth/
# - RMA API: http://localhost/api/rma/
# - Order API: http://localhost/api/fulfil/
```

**Docker Compose Configuration:**
```yaml
version: '3.8'

services:
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./frontend/build:/usr/share/nginx/html
    depends_on:
      - authinator
      - rmainator
      - FULFILinator

  authinator:
    build: ./authinator
    ports:
      - "8001:8000"
    environment:
      - DATABASE_URL=sqlite:///db.sqlite3
      - SECRET_KEY=${AUTH_SECRET_KEY}
      - DEBUG=True
    volumes:
      - ./authinator:/app
      - auth_db:/app/db

  rmainator:
    build: ./rmainator
    ports:
      - "8002:8000"
    environment:
      - DATABASE_URL=sqlite:///db.sqlite3
      - SECRET_KEY=${RMA_SECRET_KEY}
      - AUTH_SERVICE_URL=http://authinator:8000
      - DEBUG=True
    volumes:
      - ./rmainator:/app
      - rma_db:/app/db

  FULFILinator:
    build: ./FULFILinator
    ports:
      - "8003:8000"
    environment:
      - DATABASE_URL=sqlite:///db.sqlite3
      - SECRET_KEY=${ORDER_SECRET_KEY}
      - AUTH_SERVICE_URL=http://authinator:8000
      - DEBUG=True
    volumes:
      - ./FULFILinator:/app
      - order_db:/app/db

volumes:
  auth_db:
  rma_db:
  order_db:
```

### Production Environment

**Considerations:**
- Use PostgreSQL instead of SQLite for better concurrency and performance
- Configure proper SSL certificates (Let's Encrypt)
- Set DEBUG=False in Django
- Use production WSGI server (gunicorn)
- Configure proper logging and monitoring
- Set up automated backups
- Use environment variables for secrets (never commit to repo)
- Consider using Kubernetes for orchestration at scale

**Database Migration:**
- SQLite → PostgreSQL migration path documented
- Backup procedures before migrations
- Test migrations in staging environment first

### Environment Variables

**Authinator:**
- `DATABASE_URL` - Database connection string
- `SECRET_KEY` - Django secret key
- `DEBUG` - Debug mode (False in production)
- `ALLOWED_HOSTS` - Allowed host names
- `JWT_SECRET_KEY` - JWT signing key
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD` - SMTP config

**FULFILinator:**
- `DATABASE_URL` - Database connection string
- `SECRET_KEY` - Django secret key
- `DEBUG` - Debug mode (False in production)
- `AUTH_SERVICE_URL` - URL to Authinator
- `ALLOWED_HOSTS` - Allowed host names

**RMAinator:**
- (Similar to FULFILinator)

---

## Appendix: Interview Questions and Answers

### Question 1: Project Architecture Approach
**Answer:** 1 - Develop as separate application with shared authentication

### Question 2: Shared Authentication Strategy
**Answer:** 1 - Shared authentication service (microservice)

### Question 3: Database Architecture
**Answer:** 1 - Separate databases per service

### Question 4: Customer vs User Relationship
**Answer:** 2 - Customer as separate entity with multiple users (B2B model)

### Question 5: User Roles and Permissions Within a Customer
**Answer:** 2 - Customer-level roles (System Admin, Customer Admin, Customer User, Customer Read-Only)

### Question 6: Technology Stack
**Answer:** 1 - Same stack for all services: Django + React + SQLite

### Question 7: Deployment and Service Communication
**Answer:** 1 - Docker Compose with API Gateway (nginx)

### Question 8: Frontend Architecture and User Experience
**Answer:** 1 - Unified frontend shell (Single Page Application)

### Question 9: PO to Order Fulfillment Logic
**Answer:** A=1 (PO allocation at Order creation time, oldest-first), B=1 (Orders can be ad-hoc without PO)

### Question 10: Delivery to Order Fulfillment Logic
**Answer:** A=1 (Fulfill oldest Order line items first), B=1 (One Delivery can contain items from multiple Orders), C=1 (Serial numbers required at creation)

### Question 11: Payment and Invoice Tracking
**Answer:** A=3 (No automated payment tracking), B=No invoices tracked, C=2 (No payment tracking) - Focus on fulfillment, not accounting

### Question 12: Item Pricing and Discounts
**Answer:** Pricing: MSRP/min at Item level, price per PO, can override at Order/Delivery. Items: flat list. No discount tracking.

### Question 13: Modification History and Audit Trail
**Answer:** Fulfillment visibility (not compliance audit trail) - show what was ordered/delivered from which POs/Orders

### Question 14: Admin Alerts and PO/Order Closure
**Answer:** A=1 (Dashboard alerts + email), B=2 (Can close when delivered OR waived), C=2 (Closed items remain editable)

### Question 15: User Registration and Approval Workflow
**Answer:** A=1 (Same as RMAinator: Register → Approval → Active), B=2 (Customer Admins can invite users), C=1 (Full SSO/2FA/WebAuthn from RMAinator)

### Question 16: Attachments and External References
**Answer:** A=1 (File attachments supported), B=1 (Google Doc URL field), C=1 (HubSpot URL field)

### Question 17: PO Start and Expiration Dates
**Answer:** A=2 (Start date = date signed, informational), B=2 (Expiration = target deadline, soft), C=1 (Alert on expiring POs)

### Question 18: Email Notifications
**Answer:** A=2 (Minimal: only Delivery shipped to customers), B=1 (Alert-worthy events only to admins), C=1 (All users from Customer receive emails)

### Question 19: Admin Search and Filtering
**Answer:** A=1 (Comprehensive search), B=1 (Multi-filter UI), C=1 and 2 (Both predefined views and custom saved filters)

### Question 20: Admin Dashboard and Metrics
**Answer:** A=1 (Comprehensive dashboard), B=2 (No activity feed), C=2 (Single dashboard, filtered by role)

### Question 21: Critical Validations and Edge Cases
**Answer:** A=1 (Block over-fulfillment with override), B=1 (Can delete if no dependencies), C=1 (Strict validation with admin override) - "System warns but doesn't block"

### Question 22: Testing and Quality Assurance
**Answer:** 1 - Comprehensive testing (unit, integration, E2E, 80%+ coverage)

---

## Next Steps

To begin implementation, type: **"implement SPECIFICATION.md"**

The implementation will follow the phased approach above, starting with Phase 1 (Shared Authinator extraction).
