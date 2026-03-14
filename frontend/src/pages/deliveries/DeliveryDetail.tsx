import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { deliveriesApi, itemsApi } from '../../api';
import { getFulfilErrorMessage } from '../../types';
import type { Delivery, Item } from '../../types';
import { AttachmentList } from '../../components/AttachmentList';
import { useAuth } from '@inator/shared/auth/AuthProvider';

/** Detail view for a Delivery with serial numbers and attachments. */
export function DeliveryDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [items, setItems] = useState<Record<number, Item>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      void loadDelivery(parseInt(id));
      void loadItems();
    }
  }, [id]);

  const loadDelivery = async (deliveryId: number): Promise<void> => {
    try {
      setLoading(true);
      setDelivery(await deliveriesApi.get(deliveryId));
      setError('');
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to load delivery'));
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (): Promise<void> => {
    try {
      const data = await itemsApi.list();
      const map: Record<number, Item> = {};
      data.forEach((item) => {
        map[item.id] = item;
      });
      setItems(map);
    } catch {
      /* non-critical */
    }
  };

  const handleClose = async (): Promise<void> => {
    if (!delivery || !window.confirm('Are you sure you want to close this delivery?')) return;
    try {
      setDelivery(await deliveriesApi.close(delivery.id));
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to close delivery'));
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  if (error && !delivery)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
        <p className="font-medium">Error</p>
        <p>{error}</p>
      </div>
    );
  if (!delivery)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
        <p className="font-medium">Error</p>
        <p>Delivery not found</p>
      </div>
    );

  return (
    <div>
      <div className="mb-6">
        <div className="text-right">
          <Link to="/deliveries" className="mb-2 inline-block text-blue-600 hover:underline">
            ← Back to Deliveries
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{delivery.delivery_number}</h1>
            <span
              className={`mt-2 inline-block rounded px-3 py-1 text-sm font-medium ${delivery.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
            >
              {delivery.status}
            </span>
          </div>
          <div className="space-x-2">
            {isAdmin && delivery.status === 'OPEN' && (
              <button
                type="button"
                onClick={() => void handleClose()}
                className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                Close Delivery
              </button>
            )}
            {isAdmin && (
              <Link to={`/deliveries/${String(delivery.id)}/edit`}>
                <button
                  type="button"
                  className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                >
                  Edit
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Delivery Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {delivery.customer_name ?? delivery.customer_id}
                {delivery.customer_name && (
                  <span className="ml-2 text-xs text-gray-500">({delivery.customer_id})</span>
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
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Timestamps</h2>
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

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">Items &amp; Serial Numbers</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Item
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Serial Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Price/Unit
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Order Line
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {delivery.line_items.map((li, idx) => {
              const item = items[li.item];
              return (
                <tr key={idx}>
                  <td className="px-4 py-3">
                    {item ? `${item.name} ${item.version}` : `Item #${String(li.item)}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-blue-600">{li.serial_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    {li.price_per_unit ? `$${li.price_per_unit}` : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    {li.order_line_item ? (
                      <span className="text-blue-600">Order Line #{li.order_line_item}</span>
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

      <div className="mt-6">
        <AttachmentList contentType="DELIVERY" objectId={delivery.id} />
      </div>
    </div>
  );
}
