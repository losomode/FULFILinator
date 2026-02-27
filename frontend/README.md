# FULFILinator Frontend

React/TypeScript SPA for the FULFILinator order fulfillment system.

## Stack

- React 18, TypeScript, Vite
- Tailwind CSS
- Axios (API client)
- Vitest + React Testing Library

## Development

```bash
# From this directory, or use `task frontend:dev` from project root
npm install
npm run dev          # Start dev server on port 3000
npm test             # Run tests
npm run test:coverage  # Tests with coverage (≥85% functions)
npm run build        # Production build
npm run lint         # ESLint
```

## Structure

```
src/
├── api/           # API clients (deliveries, orders, pos, items) and shared types
├── components/    # Shared components (Button, FormField, ErrorMessage, Layout, etc.)
├── hooks/         # Custom hooks (useUser)
├── pages/         # Route pages
│   ├── deliveries/  # DeliveryList, DeliveryForm, DeliveryDetail, SerialSearch
│   ├── orders/      # OrderList, OrderForm, OrderDetail
│   ├── pos/         # POList, POForm, PODetail
│   └── items/       # ItemList, ItemForm
└── utils/         # Auth utilities
```
