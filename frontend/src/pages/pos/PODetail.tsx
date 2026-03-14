import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { posApi, itemsApi } from '../../api';
import { getFulfilErrorMessage } from '../../types';
import { getAxiosErrorData } from '@inator/shared/types';
import type { PurchaseOrder, Item } from '../../types';
import { AttachmentList } from '../../components/AttachmentList';
import { useAuth } from '@inator/shared/auth/AuthProvider';

/** Detail view for a Purchase Order with fulfillment status and waive functionality. */
export function PODetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<Record<number, Item>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWaiveModal, setShowWaiveModal] = useState(false);
  const [waiveLineItemId, setWaiveLineItemId] = useState<number | null>(null);
  const [waiveQuantity, setWaiveQuantity] = useState(0);
  const [waiveReason, setWaiveReason] = useState('');
  const [waiveError, setWaiveError] = useState('');

  useEffect(() => {
    if (id) {
      void loadPO(parseInt(id));
      void loadItems();
    }
  }, [id]);

  const loadPO = async (poId: number): Promise<void> => {
    try {
      setLoading(true);
      const data = await posApi.get(poId);
      setPo(data);
      setError('');
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to load PO'));
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (): Promise<void> => {
    try {
      const data = await itemsApi.list();
      const itemsMap: Record<number, Item> = {};
      data.forEach((item) => {
        itemsMap[item.id] = item;
      });
      setItems(itemsMap);
    } catch {
      // Non-critical
    }
  };

  const handleClose = async (): Promise<void> => {
    if (!po) return;
    try {
      const updated = await posApi.close(po.id);
      setPo(updated);
      setError('');
    } catch (err: unknown) {
      const errData = getAxiosErrorData(err);
      if (
        errData?.can_override &&
        window.confirm(
          `${String(errData.error)}\n\nDo you want to force close with admin override?`,
        )
      ) {
        const reason = window.prompt('Enter override reason:');
        if (reason) {
          try {
            const updated = await posApi.close(po.id, true, reason);
            setPo(updated);
            setError('');
          } catch (overrideErr: unknown) {
            setError(getFulfilErrorMessage(overrideErr, 'Failed to close PO'));
          }
        }
      } else {
        setError(typeof errData?.error === 'string' ? errData.error : 'Failed to close PO');
      }
    }
  };

  const handleWaiveClick = (lineItemId: number, remaining: number): void => {
    setWaiveLineItemId(lineItemId);
    setWaiveQuantity(remaining);
    setWaiveReason('');
    setWaiveError('');
    setShowWaiveModal(true);
  };

  const handleWaiveSubmit = async (): Promise<void> => {
    if (!po || !waiveLineItemId) return;
    if (waiveQuantity <= 0) {
      setWaiveError('Quantity must be positive');
      return;
    }
    try {
      await posApi.waive(po.id, waiveLineItemId, waiveQuantity, waiveReason);
      setShowWaiveModal(false);
      await loadPO(po.id);
      setError('');
    } catch (err: unknown) {
      setWaiveError(getFulfilErrorMessage(err, 'Failed to waive quantity'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }
  if (!po) {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
        <p className="font-medium">Error</p>
        <p>{error || 'PO not found'}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="text-right">
          <Link to="/pos" className="mb-2 inline-block text-blue-600 hover:underline">
            ← Back to Purchase Orders
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{po.po_number}</h1>
            <span
              className={`mt-2 inline-block rounded px-3 py-1 text-sm font-medium ${po.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
            >
              {po.status}
            </span>
          </div>
          {isAdmin && (
            <div className="space-x-2">
              {po.status === 'OPEN' && (
                <button
                  type="button"
                  onClick={() => void handleClose()}
                  className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                >
                  Close PO
                </button>
              )}
              <Link to={`/pos/${String(po.id)}/edit`}>
                <button
                  type="button"
                  className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                >
                  Edit
                </button>
              </Link>
            </div>
          )}
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
          <h2 className="mb-4 text-xl font-semibold">PO Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {po.customer_name ?? po.customer_id}
                {po.customer_name && (
                  <span className="ml-2 text-xs text-gray-500">({po.customer_id})</span>
                )}
              </dd>
            </div>
            {po.start_date && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{po.start_date}</dd>
              </div>
            )}
            {po.expiration_date && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Expiration Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{po.expiration_date}</dd>
              </div>
            )}
            {po.google_doc_url && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Google Doc</dt>
                <dd className="mt-1 text-sm">
                  <a
                    href={po.google_doc_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View Document
                  </a>
                </dd>
              </div>
            )}
            {po.hubspot_url && (
              <div>
                <dt className="text-sm font-medium text-gray-500">HubSpot</dt>
                <dd className="mt-1 text-sm">
                  <a
                    href={po.hubspot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View in HubSpot
                  </a>
                </dd>
              </div>
            )}
            {po.notes && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Notes</dt>
                <dd className="mt-1 text-sm text-gray-900">{po.notes}</dd>
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
                {po.created_at ? new Date(po.created_at).toLocaleString() : 'N/A'}
              </dd>
            </div>
            {po.closed_at && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Closed</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(po.closed_at).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Line Items */}
      <div className="rounded-lg bg-white p-6 shadow">
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
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {po.line_items.map((lineItem, index) => {
              const item = items[lineItem.item];
              const total = parseFloat(lineItem.price_per_unit) * lineItem.quantity;
              return (
                <tr key={index}>
                  <td className="px-4 py-3">
                    {item ? `${item.name} ${item.version}` : `Item #${String(lineItem.item)}`}
                  </td>
                  <td className="px-4 py-3">{lineItem.quantity}</td>
                  <td className="px-4 py-3">${lineItem.price_per_unit}</td>
                  <td className="px-4 py-3">${total.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                Total:
              </td>
              <td className="px-4 py-3 font-semibold">
                $
                {po.line_items
                  .reduce((sum, li) => sum + parseFloat(li.price_per_unit) * li.quantity, 0)
                  .toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Fulfillment Status */}
      <div className="mt-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">Fulfillment Status</h2>
        {po.fulfillment_status && po.fulfillment_status.line_items.length > 0 ? (
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
                    Ordered Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Waived Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Remaining Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Status
                  </th>
                  {isAdmin && po.status === 'OPEN' && (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {po.fulfillment_status.line_items.map((fulfillment, index) => {
                  const waivedQty = fulfillment.waived_quantity ?? 0;
                  const orderedQty = fulfillment.ordered_quantity ?? 0;
                  const percentage = (orderedQty / fulfillment.original_quantity) * 100;
                  const isComplete = fulfillment.remaining_quantity === 0;
                  return (
                    <tr key={index}>
                      <td className="px-4 py-3">{fulfillment.item_name}</td>
                      <td className="px-4 py-3">{fulfillment.original_quantity}</td>
                      <td className="px-4 py-3">{orderedQty}</td>
                      <td className="px-4 py-3">
                        {waivedQty > 0 ? (
                          <span className="text-orange-600">{waivedQty}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            fulfillment.remaining_quantity === 0 ? 'font-medium text-green-600' : ''
                          }
                        >
                          {fulfillment.remaining_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isComplete ? (
                          <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                            Complete
                          </span>
                        ) : percentage > 0 ? (
                          <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                            {percentage.toFixed(0)}% Ordered
                          </span>
                        ) : waivedQty > 0 ? (
                          <span className="rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
                            Partially Waived
                          </span>
                        ) : (
                          <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                            Not Started
                          </span>
                        )}
                      </td>
                      {isAdmin && po.status === 'OPEN' && (
                        <td className="px-4 py-3">
                          {fulfillment.remaining_quantity > 0 && (
                            <button
                              type="button"
                              className="rounded bg-gray-200 px-3 py-1 text-xs font-medium text-gray-800 hover:bg-gray-300"
                              onClick={() =>
                                handleWaiveClick(
                                  fulfillment.line_item_id,
                                  fulfillment.remaining_quantity,
                                )
                              }
                            >
                              Waive
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {po.fulfillment_status.orders.length > 0 && (
              <div>
                <h3 className="mb-3 text-lg font-semibold">Orders Fulfilled from this PO</h3>
                <ul className="space-y-2">
                  {po.fulfillment_status.orders.map((order) => (
                    <li key={order.order_id}>
                      <Link
                        to={`/orders/${String(order.order_id)}`}
                        className="text-blue-600 hover:underline"
                      >
                        {order.order_number}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-600">No orders have been created against this PO yet.</p>
        )}
      </div>

      <div className="mt-6">
        <AttachmentList contentType="PO" objectId={po.id} readOnly />
      </div>

      {/* Waive Modal */}
      {showWaiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Waive Remaining Quantity</h3>
            {waiveError && (
              <div className="mb-4 rounded border border-red-300 bg-red-100 p-3 text-red-800">
                {waiveError}
              </div>
            )}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Quantity to Waive
              </label>
              <input
                type="number"
                min="1"
                value={waiveQuantity}
                onChange={(e) => setWaiveQuantity(parseInt(e.target.value) || 0)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Reason (optional)
              </label>
              <textarea
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
                rows={3}
                placeholder="Enter reason for waiving..."
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => void handleWaiveSubmit()}
                className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                Waive Quantity
              </button>
              <button
                type="button"
                onClick={() => setShowWaiveModal(false)}
                className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
