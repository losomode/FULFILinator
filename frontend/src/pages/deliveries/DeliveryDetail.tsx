import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { deliveriesApi } from '../../api/deliveries';
import { itemsApi } from '../../api/items';
import { getApiErrorMessage, Delivery, Item } from '../../api/types';
import Button from '../../components/Button';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import AttachmentList from '../../components/AttachmentList';

const DeliveryDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [items, setItems] = useState<{ [key: number]: Item }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadDelivery(parseInt(id));
      loadItems();
    }
  }, [id]);

  const loadDelivery = async (deliveryId: number) => {
    try {
      setLoading(true);
      const data = await deliveriesApi.get(deliveryId);
      setDelivery(data);
      setError('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load delivery'));
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      const data = await itemsApi.list();
      const itemsMap = data.reduce((acc, item) => ({ ...acc, [item.id]: item }), {});
      setItems(itemsMap);
    } catch {
      // Non-critical error
    }
  };

  const handleClose = async () => {
    if (!delivery || !window.confirm('Are you sure you want to close this delivery?')) return;

    try {
      const updated = await deliveriesApi.close(delivery.id);
      setDelivery(updated);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to close delivery'));
    }
  };

  if (loading) return <Loading />;
  if (error && !delivery) return <ErrorMessage message={error} />;
  if (!delivery) return <ErrorMessage message="Delivery not found" />;

  return (
    <div>
      <div className="mb-6">
        <div className="text-right">
          <Link to="/deliveries" className="text-blue-600 hover:underline mb-2 inline-block">
            ← Back to Deliveries
          </Link>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{delivery.delivery_number}</h1>
            <span className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded ${
              delivery.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {delivery.status}
            </span>
          </div>
          <div className="space-x-2">
            {delivery.status === 'OPEN' && (
              <Button onClick={handleClose}>Close Delivery</Button>
            )}
            <Link to={`/deliveries/${delivery.id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
          </div>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Delivery Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {delivery.customer_name || delivery.customer_id}
                {delivery.customer_name && (
                  <span className="text-gray-500 text-xs ml-2">({delivery.customer_id})</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Ship Date</dt>
              <dd className="mt-1 text-sm text-gray-900">{delivery.ship_date}</dd>
            </div>
            {delivery.tracking_number && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Tracking Number</dt>
                <dd className="mt-1 text-sm text-gray-900">{delivery.tracking_number}</dd>
              </div>
            )}
            {delivery.notes && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Notes</dt>
                <dd className="mt-1 text-sm text-gray-900">{delivery.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Timestamps</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {delivery.created_at ? new Date(delivery.created_at).toLocaleString() : 'N/A'}
              </dd>
            </div>
            {delivery.closed_at && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Closed</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(delivery.closed_at).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Line Items with Serial Numbers */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Items & Serial Numbers</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial Number</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price/Unit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Line</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {delivery.line_items.map((lineItem, index) => {
              const item = items[lineItem.item];
              return (
                <tr key={index}>
                  <td className="px-4 py-3">
                    {item ? `${item.name} ${item.version}` : `Item #${lineItem.item}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-blue-600">{lineItem.serial_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    {lineItem.price_per_unit ? `$${lineItem.price_per_unit}` : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    {lineItem.order_line_item ? (
                      <span className="text-blue-600">Order Line #{lineItem.order_line_item}</span>
                    ) : (
                      <span className="text-gray-500">N/A</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Attachments */}
      <div className="mt-6">
        <AttachmentList contentType="DELIVERY" objectId={delivery.id} />
      </div>
    </div>
  );
};

export default DeliveryDetail;
