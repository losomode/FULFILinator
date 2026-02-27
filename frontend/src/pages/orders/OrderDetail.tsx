import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ordersApi } from '../../api/orders';
import { itemsApi } from '../../api/items';
import { getApiErrorMessage, Order, Item } from '../../api/types';
import Button from '../../components/Button';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import AttachmentList from '../../components/AttachmentList';

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<{ [key: number]: Item }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadOrder(parseInt(id));
      loadItems();
    }
  }, [id]);

  const loadOrder = async (orderId: number) => {
    try {
      setLoading(true);
      const data = await ordersApi.get(orderId);
      setOrder(data);
      setError('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load order'));
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
    if (!order || !window.confirm('Are you sure you want to close this order?')) return;

    try {
      const updated = await ordersApi.close(order.id);
      setOrder(updated);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to close order'));
    }
  };

  if (loading) return <Loading />;
  if (error && !order) return <ErrorMessage message={error} />;
  if (!order) return <ErrorMessage message="Order not found" />;

  return (
    <div>
      <div className="mb-6">
        <div className="text-right">
          <Link to="/orders" className="text-blue-600 hover:underline mb-2 inline-block">
            ← Back to Orders
          </Link>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{order.order_number}</h1>
            <span className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded ${
              order.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {order.status}
            </span>
          </div>
          <div className="space-x-2">
            {order.status === 'OPEN' && (
              <Button onClick={handleClose}>Close Order</Button>
            )}
            <Link to={`/orders/${order.id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
          </div>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Order Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {order.customer_name || order.customer_id}
                {order.customer_name && (
                  <span className="text-gray-500 text-xs ml-2">({order.customer_id})</span>
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

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Timestamps</h2>
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
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Line Items</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price/Unit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Line Item</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {order.line_items.map((lineItem, index) => {
              const item = items[lineItem.item];
              return (
                <tr key={index}>
                  <td className="px-4 py-3">
                    {item ? `${item.name} ${item.version}` : `Item #${lineItem.item}`}
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
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Fulfillment Status</h2>
        {order.fulfillment_status && order.fulfillment_status.line_items.length > 0 ? (
          <>
            <table className="min-w-full divide-y divide-gray-200 mb-6">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivered Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {order.fulfillment_status.line_items.map((fulfillment, index) => {
                  const percentage = (fulfillment.delivered_quantity! / fulfillment.original_quantity) * 100;
                  const isComplete = fulfillment.remaining_quantity === 0;
                  return (
                    <tr key={index}>
                      <td className="px-4 py-3">{fulfillment.item_name}</td>
                      <td className="px-4 py-3">{fulfillment.original_quantity}</td>
                      <td className="px-4 py-3">{fulfillment.delivered_quantity || 0}</td>
                      <td className="px-4 py-3">
                        <span className={fulfillment.remaining_quantity === 0 ? 'text-green-600 font-medium' : ''}>
                          {fulfillment.remaining_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isComplete ? (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                            Fully Delivered
                          </span>
                        ) : percentage > 0 ? (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                            {percentage.toFixed(0)}% Delivered
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">
                            Not Started
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Source POs */}
              {order.fulfillment_status.source_pos && order.fulfillment_status.source_pos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Source Purchase Orders</h3>
                  <ul className="space-y-2">
                    {order.fulfillment_status.source_pos.map((po) => (
                      <li key={po.po_id}>
                        <Link 
                          to={`/pos/${po.po_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {po.po_number}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Deliveries */}
              {order.fulfillment_status.deliveries && order.fulfillment_status.deliveries.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Deliveries</h3>
                  <ul className="space-y-2">
                    {order.fulfillment_status.deliveries.map((delivery) => (
                      <li key={delivery.delivery_id}>
                        <Link 
                          to={`/deliveries/${delivery.delivery_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {delivery.delivery_number}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-gray-600">
            No deliveries have been created for this order yet.
          </p>
        )}
      </div>

      {/* Attachments */}
      <div className="mt-6">
        <AttachmentList contentType="ORDER" objectId={order.id} />
      </div>
    </div>
  );
};

export default OrderDetail;
