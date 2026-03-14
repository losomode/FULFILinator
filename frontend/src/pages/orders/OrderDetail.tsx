import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ordersApi, itemsApi } from '../../api';
import { getFulfilErrorMessage } from '../../types';
import type { Order, Item } from '../../types';
import { AttachmentList } from '../../components/AttachmentList';
import { useAuth } from '@inator/shared/auth/AuthProvider';

/** Detail view for an Order with serial numbers and attachments. */
export function OrderDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Record<number, Item>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      void loadOrder(parseInt(id));
      void loadItems();
    }
  }, [id]);

  const loadOrder = async (orderId: number): Promise<void> => {
    try {
      setLoading(true);
      setOrder(await ordersApi.get(orderId));
      setError('');
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to load order'));
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
    if (!order || !window.confirm('Are you sure you want to close this order?')) return;
    try {
      setOrder(await ordersApi.close(order.id));
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to close order'));
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  if (error && !order)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
        <p className="font-medium">Error</p>
        <p>{error}</p>
      </div>
    );
  if (!order)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
        <p className="font-medium">Error</p>
        <p>Order not found</p>
      </div>
    );

  return (
    <div>
      <div className="mb-6">
        <div className="text-right">
          <Link to="/orders" className="mb-2 inline-block text-blue-600 hover:underline">
            ← Back to Orders
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{order.order_number}</h1>
            <span
              className={`mt-2 inline-block rounded px-3 py-1 text-sm font-medium ${order.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
            >
              {order.status}
            </span>
          </div>
          <div className="space-x-2">
            {isAdmin && order.status === 'OPEN' && (
              <button
                type="button"
                onClick={() => void handleClose()}
                className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                Close Order
              </button>
            )}
            {isAdmin && (
              <Link to={`/orders/${String(order.id)}/edit`}>
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
          <h2 className="mb-4 text-xl font-semibold">Order Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {order.customer_name ?? order.customer_id}
                {order.customer_name && (
                  <span className="ml-2 text-xs text-gray-500">({order.customer_id})</span>
                )}
              </dd>
            </div>
            {order.notes && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Notes</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.notes}</dd>
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
                {order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}
              </dd>
            </div>
            {order.closed_at && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Closed</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(order.closed_at).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Line Items */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">Line Items</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Item
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Quantity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Price/Unit
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                PO Line Item
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {order.line_items.map((lineItem, index) => {
              const item = items[lineItem.item];
              return (
                <tr key={index}>
                  <td className="px-4 py-3">
                    {item ? `${item.name} ${item.version}` : `Item #${String(lineItem.item)}`}
                  </td>
                  <td className="px-4 py-3">{lineItem.quantity}</td>
                  <td className="px-4 py-3">
                    {lineItem.price_per_unit ? `$${lineItem.price_per_unit}` : 'Allocated'}
                  </td>
                  <td className="px-4 py-3">
                    {lineItem.po_line_item ? (
                      <span className="text-blue-600">PO Line #{lineItem.po_line_item}</span>
                    ) : (
                      <span className="text-gray-500">Ad-hoc</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fulfillment Status */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">Fulfillment Status</h2>
        {order.fulfillment_status && order.fulfillment_status.line_items.length > 0 ? (
          <>
            <table className="mb-6 min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Original Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Delivered Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Remaining Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {order.fulfillment_status.line_items.map((f, idx) => {
                  const deliveredQty = f.delivered_quantity ?? 0;
                  const pct = (deliveredQty / f.original_quantity) * 100;
                  const isComplete = f.remaining_quantity === 0;
                  return (
                    <tr key={idx}>
                      <td className="px-4 py-3">{f.item_name}</td>
                      <td className="px-4 py-3">{f.original_quantity}</td>
                      <td className="px-4 py-3">{deliveredQty}</td>
                      <td className="px-4 py-3">
                        <span
                          className={f.remaining_quantity === 0 ? 'font-medium text-green-600' : ''}
                        >
                          {f.remaining_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isComplete ? (
                          <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                            Fully Delivered
                          </span>
                        ) : pct > 0 ? (
                          <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                            {pct.toFixed(0)}% Delivered
                          </span>
                        ) : (
                          <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                            Not Started
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {order.fulfillment_status.source_pos.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold">Source Purchase Orders</h3>
                  <ul className="space-y-2">
                    {order.fulfillment_status.source_pos.map((po) => (
                      <li key={po.po_id}>
                        <Link
                          to={`/pos/${String(po.po_id)}`}
                          className="text-blue-600 hover:underline"
                        >
                          {po.po_number}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {order.fulfillment_status.deliveries.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold">Deliveries</h3>
                  <ul className="space-y-2">
                    {order.fulfillment_status.deliveries.map((d) => (
                      <li key={d.delivery_id}>
                        <Link
                          to={`/deliveries/${String(d.delivery_id)}`}
                          className="text-blue-600 hover:underline"
                        >
                          {d.delivery_number}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-gray-600">No deliveries have been created for this order yet.</p>
        )}
      </div>

      <div className="mt-6">
        <AttachmentList contentType="ORDER" objectId={order.id} />
      </div>
    </div>
  );
}
