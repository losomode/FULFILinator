import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { getToken, setToken, redirectToLogin } from './utils/auth';
import ItemList from './pages/items/ItemList';
import ItemForm from './pages/items/ItemForm';
import POList from './pages/pos/POList';
import POForm from './pages/pos/POForm';
import PODetail from './pages/pos/PODetail';
import OrderList from './pages/orders/OrderList';
import OrderForm from './pages/orders/OrderForm';
import OrderDetail from './pages/orders/OrderDetail';
import DeliveryList from './pages/deliveries/DeliveryList';
import DeliveryForm from './pages/deliveries/DeliveryForm';
import DeliveryDetail from './pages/deliveries/DeliveryDetail';
import SerialSearch from './pages/deliveries/SerialSearch';

function App() {

  const isReady = useMemo(() => {
    // Handle token from URL parameter FIRST (from Authinator)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (tokenFromUrl) {
      // Store token and remove from URL
      setToken(tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    } else if (!getToken()) {
      // No token in URL or localStorage, redirect to login
      redirectToLogin();
      return false;
    }
    return true;
  }, []);

  if (!isReady) {
    return <div>Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/items" replace />} />
          <Route path="/items" element={<ItemList />} />
          <Route path="/items/new" element={<ItemForm />} />
          <Route path="/items/:id/edit" element={<ItemForm />} />
          <Route path="/pos" element={<POList />} />
          <Route path="/pos/new" element={<POForm />} />
          <Route path="/pos/:id" element={<PODetail />} />
          <Route path="/pos/:id/edit" element={<POForm />} />
          <Route path="/orders" element={<OrderList />} />
          <Route path="/orders/new" element={<OrderForm />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/orders/:id/edit" element={<OrderForm />} />
          <Route path="/deliveries" element={<DeliveryList />} />
          <Route path="/deliveries/new" element={<DeliveryForm />} />
          <Route path="/deliveries/search" element={<SerialSearch />} />
          <Route path="/deliveries/:id" element={<DeliveryDetail />} />
          <Route path="/deliveries/:id/edit" element={<DeliveryForm />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
