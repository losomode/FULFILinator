# Contributing to FULFILinator

Thank you for contributing to FULFILinator! This guide will help you get started with development.

## Table of Contents

- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Code Style](#code-style)
- [Running Tests](#running-tests)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Database Migrations](#database-migrations)

## Development Setup

### Prerequisites

- Python 3.11+
- Git
- Virtual environment tool (venv)
- Authinator service (for authentication)

### Setup Steps

1. **Clone the repository**

```bash
git clone <repository-url>
cd fulfilinator/backend
```

2. **Create virtual environment**

```bash
python3.11 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

3. **Install dependencies**

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

4. **Setup environment**

```bash
cp .env.example .env
# Edit .env with your local configuration
```

5. **Run migrations**

```bash
python manage.py migrate
```

6. **Load initial data (optional)**

```bash
python manage.py loaddata initial_items.json
```

7. **Run development server**

```bash
python manage.py runserver 8001
```

## Architecture Overview

### Project Structure

```
backend/
├── config/              # Django project settings and URLs
│   ├── settings.py      # Main settings
│   ├── urls.py          # URL routing
│   └── wsgi.py          # WSGI configuration
├── core/                # Core functionality
│   ├── authentication.py  # Authinator JWT integration
│   ├── permissions.py     # Role-based permissions
│   ├── models.py          # Attachment and AdminOverride models
│   └── views.py           # Core viewsets
├── items/               # Item catalog
│   ├── models.py        # Item model
│   ├── serializers.py   # Item serializers
│   └── views.py         # Item viewsets
├── purchase_orders/     # Purchase Order management
│   ├── models.py        # PurchaseOrder and POLineItem models
│   ├── serializers.py   # PO serializers
│   ├── views.py         # PO viewsets
│   └── management/commands/  # Management commands
├── orders/              # Order management
│   ├── models.py        # Order and OrderLineItem models
│   ├── allocation.py    # PO allocation algorithm
│   ├── serializers.py   # Order serializers
│   └── views.py         # Order viewsets
├── deliveries/          # Delivery management
│   ├── models.py        # Delivery and DeliveryLineItem models
│   ├── serializers.py   # Delivery serializers
│   └── views.py         # Delivery viewsets
├── notifications/       # Email notifications
│   ├── utils.py         # Email sending functions
│   └── tests.py         # Notification tests
└── dashboard/           # Dashboard metrics and alerts
    ├── views.py         # Dashboard API views
    └── urls.py          # Dashboard URLs
```

### Key Design Patterns

#### 1. Fulfillment Chain

```
Purchase Order → Order → Delivery
```

- **Purchase Orders** track what the company bought
- **Orders** allocate PO items to customers (oldest PO first)
- **Deliveries** fulfill Orders with serial numbers

#### 2. Role-Based Permissions

Permissions are handled via Authinator JWT claims:

- `system_admin`: Full access to all resources
- `customer_admin`: Full access to their customer's resources
- `customer_user`: Read-only access to their customer's resources

See `core/permissions.py` for implementation.

#### 3. Admin Overrides

Certain business rules can be overridden by admins:

```python
# In serializers/views
if admin_override:
    # Log the override
    AdminOverride.objects.create(
        entity_type='order',
        entity_id=order.id,
        override_type='over_fulfillment',
        reason=override_reason,
        user_id=user_id,
    )
    # Allow the operation
```

#### 4. Allocation Algorithm

Orders automatically allocate from POs using oldest-first logic:

```python
from orders.allocation import POAllocator

allocator = POAllocator(customer_id, item_id, quantity)
allocations = allocator.allocate()
# Returns: [(po_line_item, allocated_quantity), ...]
```

See `orders/allocation.py` for implementation.

## Code Style

### Python Style Guide

- Follow **PEP 8** style guide
- Use **4 spaces** for indentation (no tabs)
- Maximum line length: **100 characters**
- Use **meaningful variable names**

### Django Best Practices

1. **Models**
   - Use descriptive field names
   - Add `verbose_name` and `help_text` to fields
   - Implement `__str__` method for all models
   - Use `related_name` for reverse relations

2. **Serializers**
   - Use `ModelSerializer` for CRUD operations
   - Add validation in `validate()` or `validate_<field>()`
   - Include proper error messages

3. **Views**
   - Use `ViewSet` for standard CRUD
   - Use `@action` for custom endpoints
   - Keep business logic in models or services
   - Return appropriate HTTP status codes

4. **Tests**
   - Test filename: `test_*.py`
   - Use descriptive test names: `test_<what>_<condition>_<expected>`
   - Use fixtures for test data setup
   - Mock external dependencies (Authinator, emails)

### Example Code Style

```python
# Good
class PurchaseOrder(models.Model):
    """Purchase Order model representing items bought from vendors."""
    
    po_number = models.CharField(
        max_length=50,
        unique=True,
        help_text="Unique PO identifier"
    )
    customer_id = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Customer ID from Authinator"
    )
    
    def __str__(self):
        return f"PO {self.po_number} - {self.customer_id}"
    
    def is_ready_to_close(self):
        """Check if all line items are fulfilled or waived."""
        return all(
            li.is_fulfilled() or li.is_waived()
            for li in self.line_items.all()
        )

# Bad
class PurchaseOrder(models.Model):
    po = models.CharField(max_length=50)  # Unclear name
    cust = models.CharField(max_length=50)  # Abbreviated
    
    # Missing __str__, help_text, docstrings
```

## Running Tests

### Run all tests

```bash
pytest
```

### Run with coverage

```bash
pytest --cov=. --cov-report=term-missing
```

### Run specific app tests

```bash
pytest core/tests.py
pytest purchase_orders/
pytest orders/test_allocation.py
```

### Run specific test class or function

```bash
pytest core/tests.py::TestAuthentication
pytest core/tests.py::TestAuthentication::test_valid_jwt
```

### Writing Tests

Example test structure:

```python
import pytest
from django.test import TestCase
from unittest.mock import patch, MagicMock

class TestPurchaseOrder(TestCase):
    """Test Purchase Order functionality."""
    
    def setUp(self):
        """Setup test data before each test."""
        self.customer_id = "CUST001"
        self.item = Item.objects.create(
            name="Test Item",
            sku="TEST-001",
            msrp=100.00
        )
    
    def test_create_po_success(self):
        """Test creating a PO with valid data."""
        po = PurchaseOrder.objects.create(
            po_number="PO-2025-001",
            customer_id=self.customer_id,
            po_date="2025-01-15",
            expiration_date="2025-07-15"
        )
        self.assertEqual(po.po_number, "PO-2025-001")
        self.assertEqual(po.status, "open")
    
    @patch('notifications.utils.send_mail')
    def test_email_sent_on_close(self, mock_send_mail):
        """Test email notification sent when PO is closed."""
        po = self.create_test_po()
        po.close()
        
        mock_send_mail.assert_called_once()
```

### Test Coverage Goals

- Overall coverage: **≥80%**
- Critical paths (allocation, fulfillment): **≥95%**
- Views: **≥70%** (covered by integration tests)
- Serializers: **≥70%** (validation logic)

## Making Changes

### Branch Naming

- Feature: `feature/short-description`
- Bug fix: `bugfix/issue-description`
- Hotfix: `hotfix/critical-issue`

Examples:
- `feature/add-po-notes-field`
- `bugfix/allocation-edge-case`
- `hotfix/auth-token-expiry`

### Commit Messages

Follow conventional commits format:

```
<type>: <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `style`: Code style changes (formatting)
- `chore`: Maintenance tasks

Examples:
```
feat: add notes field to Purchase Orders

Add a notes field to store additional PO information.
Includes migration and serializer updates.

Closes #123

fix: correct allocation algorithm for multi-PO orders

The allocation algorithm was not correctly handling
cases where an order spans multiple POs. Fixed by
updating the sort order and available quantity calculation.

Fixes #456
```

### Development Workflow

1. **Create feature branch**

```bash
git checkout -b feature/your-feature
```

2. **Make changes**
   - Write code
   - Add tests
   - Update documentation

3. **Run tests**

```bash
pytest --cov=. --cov-report=term-missing
```

4. **Commit changes**

```bash
git add .
git commit -m "feat: add your feature"
```

5. **Push to remote**

```bash
git push origin feature/your-feature
```

6. **Create Pull Request**

## Pull Request Process

### Before Submitting PR

- [ ] All tests pass: `pytest`
- [ ] Code coverage maintained (≥80%)
- [ ] Code follows style guide
- [ ] Documentation updated (if needed)
- [ ] No sensitive data (keys, passwords) in code
- [ ] Migrations created (if models changed)

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe testing performed

## Checklist
- [ ] Tests pass
- [ ] Coverage maintained
- [ ] Documentation updated
- [ ] No sensitive data
```

### Review Process

1. Submit PR with clear description
2. Wait for automated tests to pass
3. Request review from maintainers
4. Address review comments
5. Maintainer approves and merges

## Database Migrations

### Creating Migrations

After changing models:

```bash
python manage.py makemigrations
python manage.py migrate
```

### Migration Best Practices

1. **Test migrations**
   - Test forward migration: `python manage.py migrate`
   - Test backward migration: `python manage.py migrate <app> <previous_migration>`

2. **Data migrations**
   - Use `RunPython` for data transformations
   - Always provide `reverse` operation

3. **Review migration file**
   - Check for unintended changes
   - Ensure migration is reversible

Example data migration:

```python
from django.db import migrations

def set_default_status(apps, schema_editor):
    PurchaseOrder = apps.get_model('purchase_orders', 'PurchaseOrder')
    PurchaseOrder.objects.filter(status__isnull=True).update(status='open')

def reverse_set_status(apps, schema_editor):
    # Reverse operation (optional)
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('purchase_orders', '0001_initial'),
    ]
    
    operations = [
        migrations.RunPython(set_default_status, reverse_set_status),
    ]
```

## Common Development Tasks

### Add new model field

1. Update model in `models.py`
2. Create migration: `python manage.py makemigrations`
3. Apply migration: `python manage.py migrate`
4. Update serializer (if needed)
5. Update tests
6. Update API documentation

### Add new API endpoint

1. Add method to viewset with `@action` decorator
2. Add tests for new endpoint
3. Update API documentation

### Add email notification

1. Add function in `notifications/utils.py`
2. Call function from appropriate view/signal
3. Add tests with mocked email sending

## Questions or Issues?

- Check existing documentation (README.md, DEPLOYMENT.md)
- Review existing code for patterns
- Ask in project discussions or issues

## License

[Add license information]
