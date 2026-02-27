import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi } from '../../api/orders';
import { getApiErrorMessage, Order } from '../../api/types';
import Button from '../../components/Button';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import { useUser } from '../../hooks/useUser';

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAdmin } = useUser();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await ordersApi.list();
      setOrders(data);
      setError('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load orders'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;

    try {
      await ordersApi.delete(id);
      loadOrders();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to delete order'));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Orders</h1>
        {isAdmin && (
          <Link to="/orders/new">
            <Button>Create Order</Button>
          </Link>
        )}
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-6 py-4 text-center text-gray-500">
                  No orders found{isAdmin && '. Create your first order to get started'}.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                    <Link to={`/orders/${order.id}`}>{order.order_number}</Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.customer_name || order.customer_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      order.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{order.line_items?.length || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap space-x-2">
                      <Link to={`/orders/${order.id}/edit`}>
                        <Button variant="secondary" className="text-sm">Edit</Button>
                      </Link>
                      <Button
                        variant="danger"
                        className="text-sm"
                        onClick={() => handleDelete(order.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderList;
