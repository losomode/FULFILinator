# Product Requirements Document: FULFILinator

**Generated**: 2026-02-22
**Status**: Ready for AI Interview  
**Note**: References to Docker and container deployment in this document are outdated. The inator family no longer uses Docker. See `INATOR.md` for current architecture.

## Initial Input

**Project Description**: This is a system to track all Purchase Orders (PO), Orders, and Deliveries for a company.  The company will interact with the admin side of the app and customers will interact with the User side.  The User side will allow users to View all of their PO. Orders, and Deliveries both active and closed.  Users can not edit any data, only view it.  Admins will handle all creation of items, PO's, Orders, and Deliveries.   Note - we may combine this wik RMAinator in the future so make all design decisions in accordance with that project.  

**I want to build FULFILinator that has the following features:**
1. General Rules
  MUST recommend if it is better to develop as separate app and then merge with RMAinator or if it is beeter to develop as a superset of RMAinator
  MUST support SSO (See RMAinator for details), 2FA, and Security Keys for Users
  MUST use Reference materials in Reference Directory for details on PO and orders
  MUST use design principles and models consostent with RMAinator
  MUST use look and feel consistent with RMAinator
  MUST support an admin interfce
  MUST support a serparate User interface
  MUST be muti-tenet
  MUST isolate data for each User such that a User cna see only their information

PO Rules
	MUST belong to exactly one customer
	MUST have at least one Item type and at least one Item qty
	MAY assign Item price and qty oer Item type fo the PO
	MAY have multiple Orders applied to it
	SHOULD have a start and expiration date
	SHOULD support an attachment, Google Doc, and/or HubSpot reference
	MUST maintain all original information and a modification history
	MUST be updated for Items remaining on PO when Orders associated with PO are closed
	MUST alert Admin to close PO when all Items on the PO are delivered
	MUST only be closed by an admin when all items on the PO have been fulfilled

Order Rules
	MAY apply to multiple POs but only one customer
	MAY be created without an associated PO
	MUST have at least one Item
	MUST inherit all data from the PO's including Custome and Item infomation
	MUST fulfil terms of the oldest PO first (e.g.  PO-1 has 30 of Item type 1 remaining on it at $2000 per and PO-2 has 100 of Item type 1 remaining at $2100 per.  An Order attached to both PO-1 and PO-2 for 50 of Item type 1 would include 30 from PO-1 at $2000 per and 30 from PO-2 at $2100 per.  PO-1 would be completed and PO-2 would have 80 of Item type 1 waiting to be fulfilled still)
	MAY have a per Order or per Item type discoutn applied
	MUST include line item refereces to PO fulfilmet if appplicable (see exacmple above)
	MUST maintain all original information and a modification history
	MUST be updated for Items remaining on Order when Deliveries associated with Order are closed
	MUST alert Admin to close Order when all Items on the Order are delivered
	MUST update all POs associated with an Order when the Order is closed
	MUST only be closed by an admin when all items on the Order have been fulfilled

Delivery Rules
	MUST be linked to an Order
	MUST include a ship date
	MAY fulfil only part of an Order (Order should be updated by Delivery in the same way that a PO is updated by an Order)
	MAY apply to multiple Orders for the same customer
	MUST NOT apply to mutiple Customers
	MUST include tracking number
	MUST include serial number per Item
	MUST update all Orders associated with a Delivery when the Delivery is closed
	MUST only be closed by an admin when all items on the Delivery have been fulfilled

Item Rules
	Includes basic info per Item type (Name, version, description, list price. minimum price)
	MAY be included by quantity on PO and Orders
	MUST be listed as single line per Item on Delivery where Serial Number must be listed
---

# Specification Generation

Agent workflow for creating project specifications via structured interview.

Legend (from RFC2119): !=MUST, ~=SHOULD, ≉=SHOULD NOT, ⊗=MUST NOT, ?=MAY.

## Input Template

```
I want to build FULFILinator that has the following features:
1. [feature]
2. [feature]
...
N. [feature]
```

## Interview Process

- ~ Use Claude AskInterviewQuestion when available (emulate it if not available)
- ! If Input Template fields are empty: ask overview, then features, then details
- ! Ask **ONE** focused, non-trivial question per step
- ⊗ ask more than one question per step; or try to sneak-in "also" questions
- ~ Provide numbered answer options when appropriate
- ! Include "other" option for custom/unknown responses
- ! make it clear which option you feel is RECOMMENDED
- ! when you are done, append to the end of this file all questions asked and answers given.

**Question Areas:**

- ! Missing decisions (language, framework, deployment)
- ! Edge cases (errors, boundaries, failure modes)
- ! Implementation details (architecture, patterns, libraries)
- ! Requirements (performance, security, scalability)
- ! UX/constraints (users, timeline, compatibility)
- ! Tradeoffs (simplicity vs features, speed vs safety)

**Completion:**

- ! Continue until little ambiguity remains
- ! Ensure spec is comprehensive enough to implement

## Output Generation

- ! Generate as SPECIFICATION.md
- ! follow all relevant deft guidelines
- ! use RFC2119 MUST, SHOULD, MAY, SHOULD NOT, MUST NOT wording
- ! Break into phases, subphases, tasks
- ! end of each phase/subphase must implement and run testing until it passes
- ! Mark all dependencies explicitly: "Phase 2 (depends on: Phase 1)"
- ! Design for parallel work (multiple agents)
- ⊗ Write code (specification only)

## Afterwards

- ! let user know to type "implement SPECIFICATION.md" to start implementation

**Structure:**

```markdown
# Project Name

## Overview

## Requirements

## Architecture

## Implementation Plan

### Phase 1: Foundation

#### Subphase 1.1: Setup

- Task 1.1.1: (description, dependencies, acceptance criteria)

#### Subphase 1.2: Core (depends on: 1.1)

### Phase 2: Features (depends on: Phase 1)

## Testing Strategy

## Deployment
```

## Best Practices

- ! Detailed enough to implement without guesswork
- ! Clear scope boundaries (in vs out)
- ! Include rationale for major decisions
- ~ Size tasks for 1-4 hours
- ! Minimize inter-task dependencies
- ! Define clear component interfaces

## Anti-Patterns

- ⊗ Multiple questions at once
- ⊗ Assumptions without clarifying
- ⊗ Vague requirements
- ⊗ Missing dependencies
- ⊗ Sequential tasks that could be parallel

---

# Interview Record

All questions asked and answers received during specification generation.

## Question 1: Project Architecture Approach
Given that FULFILinator and RMAinator share similar requirements (Django + React, SSO/2FA, multi-tenant, Admin/User interfaces), which architectural approach should be taken?

**Answer:** 1 - Develop as separate application with shared authentication

## Question 2: Shared Authentication Strategy
How should authentication be shared between FULFILinator and RMAinator?

**Answer:** 1 - Shared authentication service (microservice)

## Question 3: Database Architecture
With three systems (Authinator, RMAinator, FULFILinator), what database strategy should be used?

**Answer:** 1 - Separate databases per service

## Question 4: Customer vs User Relationship
What is the relationship between Users (who log in) and Customers (who own POs/Orders/RMAs)?

**Answer:** 2 - Customer as separate entity with multiple users (B2B model)
- Multiple users can belong to one Customer (company)
- All POs, Orders, Deliveries belong to Customer
- Data isolation at Customer level

## Question 5: User Roles and Permissions Within a Customer
Since multiple users belong to one Customer, what permission levels are needed?

**Answer:** 2 - Customer-level roles
- System Admin: Company employees who manage all data
- Customer Admin: Can invite/manage users for their company
- Customer User: Can view data, submit RMAs
- Customer Read-Only: View-only access

## Question 6: Technology Stack
Should the new services use the same stack as RMAinator (Django + React + SQLite)?

**Answer:** 1 - Same stack for all services: Django + React + SQLite

## Question 7: Deployment and Service Communication
How should the three services be deployed and communicate?

**Answer:** 1 - Docker Compose with API Gateway (nginx)
- nginx routes: /api/auth/* → Authinator, /api/rma/* → RMAinator, /api/order/* → FULFILinator
- Services communicate via REST APIs only

## Question 8: Frontend Architecture and User Experience
How should the frontend be structured across services?

**Answer:** 1 - Unified frontend shell (Single Page Application)
- Single React app with seamless navigation between Orders and RMAs
- Shared navigation bar: Orders | RMAs | Profile | Admin

## Question 9: PO to Order Fulfillment Logic
How should PO fulfillment allocation work when creating Orders?

**Answers:**
- **A=1**: PO allocation happens at Order creation time (automatic, oldest-first)
- **B=1**: Orders can be created without PO reference (ad-hoc orders)

Example: PO-1 has 30 units at $2000, PO-2 has 100 units at $2100. An Order for 50 units automatically allocates 30 from PO-1 and 20 from PO-2.

## Question 10: Delivery to Order Fulfillment Logic
How should Deliveries fulfill Orders?

**Answers:**
- **A=1**: Fulfill oldest Order line items first (consistent with PO logic)
- **B=1**: One Delivery can contain items from multiple Orders (same Customer only)
- **C=1**: Serial numbers required at Delivery creation time

## Question 11: Payment and Invoice Tracking
Should the system handle invoices and payment tracking?

**Answer:** No - Focus on fulfillment tracking only
- A=3: No automated payment tracking
- B: No invoices tracked in this system (handled in separate accounting system)
- C=2: No payment status tracking

## Question 12: Item Pricing and Discounts
How should pricing and discounts be handled?

**Answer:** Simplified pricing model
- Item level: MSRP (list price) and Minimum Price (reference only)
- PO level: Price per item type (negotiated price)
- Order level: Inherit from PO, Admin can override
- Delivery level: Inherit from Order, Admin can override
- Items: Flat list (variants are separate Items)
- No discount tracking

## Question 13: Modification History and Audit Trail
What level of modification history is needed?

**Answer:** Fulfillment visibility (not compliance audit trail)
- Show what was originally on PO vs what was ordered vs what remains
- Track relationships: Order Line Items → PO Line Items, Delivery Line Items → Order Line Items
- Calculate remaining quantities dynamically
- Audit trail is for customer visibility into fulfillment status, not regulatory compliance

## Question 14: Admin Alerts and PO/Order Closure
How should PO/Order closure and alerts work?

**Answers:**
- **A=1**: Dashboard alerts + email notifications when POs/Orders ready to close
- **B=2**: Can close when fully delivered OR remaining items explicitly waived by admin
- **C=2**: Closed items remain editable (closed = status flag only, allows corrections)

## Question 15: User Registration and Approval Workflow
What user registration process should be used?

**Answers:**
- **A=1**: Same as RMAinator (Register → Admin Approval → Active)
- **B=2**: Customer Admins can invite users to their Customer
- **C=1**: Full SSO/2FA/WebAuthn support (reuse from RMAinator)

## Question 16: Attachments and External References
What attachment and reference capabilities are needed?

**Answers:**
- **A=1**: File attachments supported (PDFs, images, Excel)
- **B=1**: Google Doc URL field (simple link)
- **C=1**: HubSpot URL/ID field (simple cross-reference)

## Question 17: PO Start and Expiration Dates
What do PO start and expiration dates represent?

**Answers:**
- **A=2**: Start date = date PO was signed/agreed (informational, for record-keeping)
- **B=2**: Expiration date = expected fulfillment deadline (soft target, no hard enforcement)
- **C=1**: Alert admins about POs expiring soon (30 days, dashboard + email)

## Question 18: Email Notifications
What email notifications should the system send?

**Answers:**
- **A=2**: Minimal customer notifications - only Delivery shipped (with tracking & serial numbers)
- **B=1**: Admin notifications for actionable items only (PO/Order ready to close, expiring, user approval needed)
- **C=1**: All users from a Customer receive notification emails

## Question 19: Admin Search and Filtering
What search and filtering capabilities do admins need?

**Answers:**
- **A=1**: Comprehensive search (all relevant fields: number, customer, items, serial numbers, dates)
- **B=1**: Multi-filter UI (combine multiple criteria: Customer + Status + Date Range + Item Type)
- **C=1 & 2**: Both predefined quick views AND custom saved filters

## Question 20: Admin Dashboard and Metrics
What should the admin dashboard display?

**Answers:**
- **A=1**: Comprehensive dashboard with all key metrics
  - PO metrics: open, expiring soon, ready to close
  - Order metrics: active, ready to close
  - Delivery metrics: recent, items shipped this month
  - Customer metrics: active customers, pending registrations
  - Fulfillment rates
- **B=2**: No activity feed (keeps it simpler)
- **C=2**: Single dashboard UI, data filtered by role/permissions

## Question 21: Critical Validations and Edge Cases
How should validation rules and edge cases be handled?

**Answers:**
- **A=1**: Block over-fulfillment with error message (with admin override option)
- **B=1**: Can delete if no dependencies (PO only if no Orders, Order only if no Deliveries)
- **C=1**: Strict validation with admin override for everything

**Key Principle:** "System warns but doesn't block - admins can override anything"
- Show warnings for unusual situations (price below minimum, over-fulfillment, duplicate serials)
- System Admins can click "Override" and proceed
- System logs all overrides for visibility

## Question 22: Testing and Quality Assurance
What level of testing should be built into the project?

**Answer:** 1 - Comprehensive testing
- Unit tests: Models, business logic, validations
- Integration tests: API endpoints, database operations
- E2E tests: Critical user flows (PO → Order → Delivery)
- Target: 80%+ code coverage
- All tests run in CI/CD pipeline

