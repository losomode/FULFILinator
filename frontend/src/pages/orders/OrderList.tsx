import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi } from '../../api';
import { getFulfilErrorMessage } from '../../types';
import type { Order } from '../../types';
import { useAuth } from '@inator/shared/auth/AuthProvider';

/** Displays a table of all orders with status and actions. */
export function OrderList(): React.JSX.Element {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAdmin } = useAuth();

  useEffect(() => {
    void loadOrders();
  }, []);

  const loadOrders = async (): Promise<void> => {
    try {
      setLoading(true);
      const data = await ordersApi.list();
      setOrders(data);
      setError('');
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to load orders'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      await ordersApi.delete(id);
      await loadOrders();
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to delete order'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Orders</h1>
        {isAdmin && (
          <Link to="/orders/new">
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              Create Order
            </button>
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Order Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Created
              </th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-6 py-4 text-center text-gray-500">
                  No orders found{isAdmin && '. Create your first order to get started'}.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-blue-600">
                    <Link to={`/orders/${String(order.id)}`}>{order.order_number}</Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {order.customer_name ?? order.customer_id}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${order.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">{order.line_items?.length ?? 0}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  {isAdmin && (
                    <td className="whitespace-nowrap px-6 py-4 space-x-2">
                      <Link to={`/orders/${String(order.id)}/edit`}>
                        <button
                          type="button"
                          className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300"
                        >
                          Edit
                        </button>
                      </Link>
                      <button
                        type="button"
                        className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                        onClick={() => void handleDelete(order.id)}
                      >
                        Delete
                      </button>
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
}
