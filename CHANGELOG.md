# Changelog

All notable changes to Fulfilinator will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Django project setup with 7 apps (core, items, purchase_orders, orders, deliveries, notifications, dashboard)
- Authinator integration (JWT validation)
- Role-based access control (RBAC) with customer data isolation
- Health check endpoint
- Purchase order management with fulfillment tracking
- Order management with oldest-first PO allocation
- Delivery management with serial number tracking
- Email notifications for key events
- Admin override system with audit trail
- Dashboard metrics and alerts API
- OpenAPI/Swagger documentation
- React TypeScript frontend
- 39+ tests with 92% coverage
