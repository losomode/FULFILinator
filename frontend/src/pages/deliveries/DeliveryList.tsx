import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deliveriesApi } from '../../api/deliveries';
import { getApiErrorMessage, Delivery } from '../../api/types';
import Button from '../../components/Button';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import { useUser } from '../../hooks/useUser';

const DeliveryList: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAdmin } = useUser();

  useEffect(() => {
    loadDeliveries();
  }, []);

  const loadDeliveries = async () => {
    try {
      setLoading(true);
      const data = await deliveriesApi.list();
      setDeliveries(data);
      setError('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load deliveries'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this delivery?')) return;

    try {
      await deliveriesApi.delete(id);
      loadDeliveries();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to delete delivery'));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Deliveries</h1>
        <div className="space-x-2">
          <Link to="/deliveries/search">
            <Button variant="secondary">Search Serial Numbers</Button>
          </Link>
          {isAdmin && (
            <Link to="/deliveries/new">
              <Button>Create Delivery</Button>
            </Link>
          )}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivery Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ship Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tracking</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="px-6 py-4 text-center text-gray-500">
                  No deliveries found{isAdmin && '. Create your first delivery to get started'}.
                </td>
              </tr>
            ) : (
              deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                    <Link to={`/deliveries/${delivery.id}`}>{delivery.delivery_number}</Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {delivery.customer_name || delivery.customer_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{delivery.ship_date}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {delivery.tracking_number || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      delivery.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {delivery.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{delivery.line_items?.length || 0}</td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap space-x-2">
                      <Link to={`/deliveries/${delivery.id}/edit`}>
                        <Button variant="secondary" className="text-sm">Edit</Button>
                      </Link>
                      <Button
                        variant="danger"
                        className="text-sm"
                        onClick={() => handleDelete(delivery.id)}
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

export default DeliveryList;
