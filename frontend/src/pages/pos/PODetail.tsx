import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { posApi } from '../../api/pos';
import { itemsApi } from '../../api/items';
import { getApiErrorMessage, getAxiosErrorData, PurchaseOrder, Item } from '../../api/types';
import Button from '../../components/Button';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import AttachmentList from '../../components/AttachmentList';

const PODetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<{ [key: number]: Item }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWaiveModal, setShowWaiveModal] = useState(false);
  const [waiveLineItemId, setWaiveLineItemId] = useState<number | null>(null);
  const [waiveQuantity, setWaiveQuantity] = useState(0);
  const [waiveReason, setWaiveReason] = useState('');
  const [waiveError, setWaiveError] = useState('');

  useEffect(() => {
    if (id) {
      loadPO(parseInt(id));
      loadItems();
    }
  }, [id]);

  const loadPO = async (poId: number) => {
    try {
      setLoading(true);
      const data = await posApi.get(poId);
      setPo(data);
      setError('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load PO'));
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
    if (!po) return;

    try {
      const updated = await posApi.close(po.id);
      setPo(updated);
      setError('');
    } catch (err: unknown) {
      const errData = getAxiosErrorData(err);
      if (errData?.can_override && window.confirm(
        `${errData.error}\n\nDo you want to force close with admin override?`
      )) {
        const reason = window.prompt('Enter override reason:');
        if (reason) {
          try {
            const updated = await posApi.close(po.id, true, reason);
            setPo(updated);
            setError('');
          } catch (overrideErr: unknown) {
            setError(getApiErrorMessage(overrideErr, 'Failed to close PO'));
          }
        }
      } else {
        setError(typeof errData?.error === 'string' ? errData.error : 'Failed to close PO');
      }
    }
  };

  const handleWaiveClick = (lineItemId: number, remaining: number) => {
    setWaiveLineItemId(lineItemId);
    setWaiveQuantity(remaining);
    setWaiveReason('');
    setWaiveError('');
    setShowWaiveModal(true);
  };

  const handleWaiveSubmit = async () => {
    if (!po || !waiveLineItemId) return;

    if (waiveQuantity <= 0) {
      setWaiveError('Quantity must be positive');
      return;
    }

    try {
      await posApi.waive(po.id, waiveLineItemId, waiveQuantity, waiveReason);
      setShowWaiveModal(false);
      loadPO(po.id); // Reload to show updated data
      setError('');
    } catch (err: unknown) {
      setWaiveError(getApiErrorMessage(err, 'Failed to waive quantity'));
    }
  };

  if (loading) return <Loading />;
  if (!po) return <ErrorMessage message="PO not found" />;

  return (
    <div>
      <div className="mb-6">
        <div className="text-right">
          <Link to="/pos" className="text-blue-600 hover:underline mb-2 inline-block">
            ← Back to Purchase Orders
          </Link>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{po.po_number}</h1>
            <span className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded ${
              po.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {po.status}
            </span>
          </div>
          <div className="space-x-2">
            {po.status === 'OPEN' && (
              <Button onClick={handleClose}>Close PO</Button>
            )}
            <Link to={`/pos/${po.id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
          </div>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">PO Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {po.customer_name || po.customer_id}
                {po.customer_name && (
                  <span className="text-gray-500 text-xs ml-2">({po.customer_id})</span>
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
                  <a href={po.google_doc_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    View Document
                  </a>
                </dd>
              </div>
            )}
            {po.hubspot_url && (
              <div>
                <dt className="text-sm font-medium text-gray-500">HubSpot</dt>
                <dd className="mt-1 text-sm">
                  <a href={po.hubspot_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
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

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Timestamps</h2>
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
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Line Items</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price/Unit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {po.line_items.map((lineItem, index) => {
              const item = items[lineItem.item];
              const total = parseFloat(lineItem.price_per_unit) * lineItem.quantity;
              return (
                <tr key={index}>
                  <td className="px-4 py-3">
                    {item ? `${item.name} ${item.version}` : `Item #${lineItem.item}`}
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
              <td colSpan={3} className="px-4 py-3 text-right font-semibold">Total:</td>
              <td className="px-4 py-3 font-semibold">
                ${po.line_items.reduce((sum, li) => sum + (parseFloat(li.price_per_unit) * li.quantity), 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Fulfillment Status */}
      <div className="bg-white shadow rounded-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Fulfillment Status</h2>
        {po.fulfillment_status && po.fulfillment_status.line_items.length > 0 ? (
          <>
            <table className="min-w-full divide-y divide-gray-200 mb-6">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordered Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waived Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  {po.status === 'OPEN' && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {po.fulfillment_status.line_items.map((fulfillment, index) => {
                  const waivedQty = fulfillment.waived_quantity || 0;
                  const percentage = (fulfillment.ordered_quantity! / fulfillment.original_quantity) * 100;
                  const isComplete = fulfillment.remaining_quantity === 0;
                  return (
                    <tr key={index}>
                      <td className="px-4 py-3">{fulfillment.item_name}</td>
                      <td className="px-4 py-3">{fulfillment.original_quantity}</td>
                      <td className="px-4 py-3">{fulfillment.ordered_quantity || 0}</td>
                      <td className="px-4 py-3">
                        {waivedQty > 0 ? (
                          <span className="text-orange-600">{waivedQty}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={fulfillment.remaining_quantity === 0 ? 'text-green-600 font-medium' : ''}>
                          {fulfillment.remaining_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isComplete ? (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                            Complete
                          </span>
                        ) : percentage > 0 ? (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                            {percentage.toFixed(0)}% Ordered
                          </span>
                        ) : waivedQty > 0 ? (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800">
                            Partially Waived
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">
                            Not Started
                          </span>
                        )}
                      </td>
                      {po.status === 'OPEN' && (
                        <td className="px-4 py-3">
                          {fulfillment.remaining_quantity > 0 && (
                            <Button
                              variant="secondary"
                              className="text-xs"
                              onClick={() => handleWaiveClick(fulfillment.line_item_id, fulfillment.remaining_quantity)}
                            >
                              Waive
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {/* Orders that fulfilled from this PO */}
            {po.fulfillment_status.orders && po.fulfillment_status.orders.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Orders Fulfilled from this PO</h3>
                <ul className="space-y-2">
                  {po.fulfillment_status.orders.map((order) => (
                    <li key={order.order_id}>
                      <Link 
                        to={`/orders/${order.order_id}`}
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
          <p className="text-gray-600">
            No orders have been created against this PO yet.
          </p>
        )}
      </div>

      {/* Attachments */}
      <div className="mt-6">
        <AttachmentList contentType="PO" objectId={po.id} />
      </div>

      {/* Waive Modal */}
      {showWaiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Waive Remaining Quantity</h3>
            {waiveError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded">
                {waiveError}
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantity to Waive</label>
              <input
                type="number"
                min="1"
                value={waiveQuantity}
                onChange={(e) => setWaiveQuantity(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason (optional)</label>
              <textarea
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                rows={3}
                placeholder="Enter reason for waiving..."
              />
            </div>
            <div className="flex space-x-3">
              <Button onClick={handleWaiveSubmit}>Waive Quantity</Button>
              <Button variant="secondary" onClick={() => setShowWaiveModal(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PODetail;
