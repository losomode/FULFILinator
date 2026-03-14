import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@inator/shared/auth/AuthProvider';
import { ProtectedRoute } from '@inator/shared/auth/ProtectedRoute';
import { Layout } from '@inator/shared/layout/Layout';
import type { NavItem } from '@inator/shared/types';
import { POList } from './pages/pos/POList';
import { POForm } from './pages/pos/POForm';
import { PODetail } from './pages/pos/PODetail';
import { OrderList } from './pages/orders/OrderList';
import { OrderForm } from './pages/orders/OrderForm';
import { OrderDetail } from './pages/orders/OrderDetail';
import { DeliveryList } from './pages/deliveries/DeliveryList';
import { DeliveryForm } from './pages/deliveries/DeliveryForm';
import { DeliveryDetail } from './pages/deliveries/DeliveryDetail';
import { SerialSearch } from './pages/deliveries/SerialSearch';
import { ItemList } from './pages/items/ItemList';
import { ItemForm } from './pages/items/ItemForm';

const NAV_ITEMS: NavItem[] = [
  { path: '/pos', label: '📦 Purchase Orders' },
  { path: '/orders', label: '📋 Orders' },
  { path: '/deliveries', label: '🚚 Deliveries' },
  { path: '/items', label: '🏷️ Items', adminOnly: true },
];

/**
 * FULFILinator frontend — manages order fulfillment workflow.
 * Served under /fulfil via Caddy reverse proxy.
 */
export default function App(): React.JSX.Element {
  return (
    <BrowserRouter basename="/fulfil">
      <AuthProvider>
        <Routes>
          {/* Purchase Orders */}
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <POList />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos/new"
            element={
              <ProtectedRoute adminOnly>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <POForm />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos/:id"
            element={
              <ProtectedRoute>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <PODetail />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos/:id/edit"
            element={
              <ProtectedRoute adminOnly>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <POForm />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Orders */}
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <OrderList />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/new"
            element={
              <ProtectedRoute adminOnly>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <OrderForm />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <ProtectedRoute>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <OrderDetail />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id/edit"
            element={
              <ProtectedRoute adminOnly>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <OrderForm />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Deliveries */}
          <Route
            path="/deliveries"
            element={
              <ProtectedRoute>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <DeliveryList />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/deliveries/search"
            element={
              <ProtectedRoute>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <SerialSearch />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/deliveries/new"
            element={
              <ProtectedRoute adminOnly>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <DeliveryForm />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/deliveries/:id"
            element={
              <ProtectedRoute>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <DeliveryDetail />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/deliveries/:id/edit"
            element={
              <ProtectedRoute adminOnly>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <DeliveryForm />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Items */}
          <Route
            path="/items"
            element={
              <ProtectedRoute adminOnly>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <ItemList />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/items/new"
            element={
              <ProtectedRoute adminOnly>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <ItemForm />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/items/:id/edit"
            element={
              <ProtectedRoute adminOnly>
                <Layout title="FULFILinator" navItems={NAV_ITEMS}>
                  <ItemForm />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/pos" replace />} />
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
