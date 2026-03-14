import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deliveriesApi } from '../../api';
import { getFulfilErrorMessage } from '../../types';
import type { Delivery } from '../../types';
import { useAuth } from '@inator/shared/auth/AuthProvider';

/** Displays a table of all deliveries with tracking info and actions. */
export function DeliveryList(): React.JSX.Element {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAdmin } = useAuth();

  useEffect(() => {
    void loadDeliveries();
  }, []);

  const loadDeliveries = async (): Promise<void> => {
    try {
      setLoading(true);
      setDeliveries(await deliveriesApi.list());
      setError('');
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to load deliveries'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Are you sure you want to delete this delivery?')) return;
    try {
      await deliveriesApi.delete(id);
      await loadDeliveries();
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to delete delivery'));
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Deliveries</h1>
        <div className="space-x-2">
          <Link to="/deliveries/search">
            <button
              type="button"
              className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
            >
              Search Serial Numbers
            </button>
          </Link>
          {isAdmin && (
            <Link to="/deliveries/new">
              <button
                type="button"
                className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                Create Delivery
              </button>
            </Link>
          )}
        </div>
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
                Delivery Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Ship Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Tracking
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Items
              </th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="px-6 py-4 text-center text-gray-500">
                  No deliveries found{isAdmin && '. Create your first delivery to get started'}.
                </td>
              </tr>
            ) : (
              deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-blue-600">
                    <Link to={`/deliveries/${String(d.id)}`}>{d.delivery_number}</Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {d.customer_name ?? d.customer_id}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">{d.ship_date}</td>
                  <td className="whitespace-nowrap px-6 py-4">{d.tracking_number ?? 'N/A'}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${d.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">{d.line_items?.length ?? 0}</td>
                  {isAdmin && (
                    <td className="whitespace-nowrap px-6 py-4 space-x-2">
                      <Link to={`/deliveries/${String(d.id)}/edit`}>
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
                        onClick={() => void handleDelete(d.id)}
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
