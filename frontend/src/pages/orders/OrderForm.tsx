import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ordersApi, itemsApi, posApi } from '../../api';
import { getFulfilErrorMessage, getApiFieldErrors } from '../../types';
import type { Item, Order, OrderLineItem, PurchaseOrder, FieldErrors } from '../../types';
import { useAuth } from '@inator/shared/auth/AuthProvider';

/** Form for creating or editing an Order with optional PO allocation. */
export function OrderForm(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [items, setItems] = useState<Item[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [showAllocationPreview, setShowAllocationPreview] = useState(false);
  const [allocateFromPo, setAllocateFromPo] = useState(true);
  const [formData, setFormData] = useState({
    customer_id: '',
    notes: '',
    status: 'OPEN' as 'OPEN' | 'CLOSED',
    created_by_user_id: user?.username ?? '',
    line_items: [] as OrderLineItem[],
  });

  useEffect(() => {
    void loadItems();
    if (isEdit && id) void loadOrder(parseInt(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  useEffect(() => {
    void loadPOs(formData.customer_id);
  }, [formData.customer_id]);

  const loadItems = async (): Promise<void> => {
    try {
      setItems(await itemsApi.list());
    } catch {
      setError('Failed to load items');
    }
  };

  const loadPOs = async (customerId: string): Promise<void> => {
    try {
      const data = await posApi.list();
      setPos(
        data
          .filter(
            (po) =>
              po.customer_id.toLowerCase() === customerId.toLowerCase() && po.status === 'OPEN',
          )
          .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? '')),
      );
    } catch {
      /* non-critical */
    }
  };

  const getPoPrice = (itemId: number): string | null => {
    for (const po of pos) {
      if (po.fulfillment_status) {
        const li = po.fulfillment_status.line_items.find(
          (fl) => fl.item_id === itemId && fl.remaining_quantity > 0,
        );
        if (li) return li.price_per_unit;
      }
    }
    return null;
  };

  const loadOrder = async (orderId: number): Promise<void> => {
    try {
      setLoading(true);
      const data = await ordersApi.get(orderId);
      setFormData({
        customer_id: data.customer_id,
        notes: data.notes ?? '',
        status: data.status,
        created_by_user_id: data.created_by_user_id ?? user?.username ?? '',
        line_items: data.line_items ?? [],
      });
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to load order'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addLineItem = (): void => {
    setFormData({ ...formData, line_items: [{ item: 0, quantity: 1 }, ...formData.line_items] });
  };

  const updateLineItem = (
    index: number,
    field: keyof OrderLineItem,
    value: string | number,
  ): void => {
    const updated = [...formData.line_items];
    updated[index] = { ...updated[index]!, [field]: value };
    setFormData({ ...formData, line_items: updated });
  };

  const removeLineItem = (index: number): void => {
    setFormData({ ...formData, line_items: formData.line_items.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (formData.line_items.length === 0) {
      setError('At least one line item is required');
      return;
    }

    try {
      if (isEdit && id) {
        await ordersApi.update(parseInt(id), formData);
      } else {
        await ordersApi.create({ ...formData, allocate_from_po: allocateFromPo } as Omit<
          Order,
          'id' | 'order_number'
        > & { allocate_from_po: boolean });
      }
      navigate('/orders');
    } catch (err: unknown) {
      const fe = getApiFieldErrors(err);
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        const topLevel = Object.entries(fe)
          .filter(([k]) => !k.includes('['))
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
        const lineItemErrors = Object.entries(fe).filter(([k]) => k.includes('['));
        const parts = [...topLevel];
        if (lineItemErrors.length > 0)
          parts.push(
            `${String(lineItemErrors.length)} line item error(s) — see highlighted fields below`,
          );
        setError(parts.join('. '));
      } else {
        setError(getFulfilErrorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} order`));
      }
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
      <h1 className="mb-6 text-3xl font-bold">{isEdit ? 'Edit Order' : 'Create Order'}</h1>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="mb-4">
            <label htmlFor="customer_id" className="mb-1 block text-sm font-medium text-gray-700">
              Customer ID <span className="text-red-500">*</span>
            </label>
            <input
              id="customer_id"
              name="customer_id"
              value={formData.customer_id}
              onChange={handleChange}
              required
              className={`w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 ${fieldErrors.customer_id ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
            />
            {fieldErrors.customer_id && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.customer_id}</p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {!isEdit && (
            <>
              <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-4">
                <label className="flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={allocateFromPo}
                    onChange={(e) => setAllocateFromPo(e.target.checked)}
                    className="mr-2"
                  />
                  <strong className="text-sm text-blue-800">Automatic PO Allocation</strong>
                </label>
                {allocateFromPo && (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm text-blue-800">
                      Items will be allocated from the oldest available Purchase Orders.
                    </p>
                    <button
                      type="button"
                      className="rounded bg-gray-200 px-3 py-1 text-sm font-medium text-gray-800 hover:bg-gray-300"
                      onClick={() => setShowAllocationPreview(!showAllocationPreview)}
                    >
                      {showAllocationPreview ? 'Hide' : 'Show'} Preview
                    </button>
                  </div>
                )}
                {!allocateFromPo && (
                  <p className="mt-2 text-sm text-blue-800">
                    Ad-hoc order — you must specify a price per unit for each line item.
                  </p>
                )}
              </div>

              {allocateFromPo && showAllocationPreview && (
                <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold">Available POs for Allocation</h4>
                  {pos.length === 0 ? (
                    <p className="text-sm text-gray-600">
                      No open POs found for customer {formData.customer_id}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {pos.map((po) => (
                        <div key={po.id} className="rounded border border-gray-200 bg-white p-3">
                          <div className="mb-2 flex items-start justify-between">
                            <div>
                              <span className="text-sm font-medium">{po.po_number}</span>
                              {po.start_date && (
                                <span className="ml-2 text-xs text-gray-500">
                                  Start: {po.start_date}
                                </span>
                              )}
                            </div>
                          </div>
                          {po.fulfillment_status && po.fulfillment_status.line_items.length > 0 && (
                            <div className="space-y-1 text-xs">
                              {po.fulfillment_status.line_items.map((item, idx) => {
                                if (item.remaining_quantity === 0) return null;
                                return (
                                  <div key={idx} className="flex justify-between text-gray-700">
                                    <span>{item.item_name}</span>
                                    <span className="font-medium">
                                      {item.remaining_quantity} available
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Line Items */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium">Line Items</h3>
              <button
                type="button"
                onClick={addLineItem}
                className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
              >
                Add Item
              </button>
            </div>

            {formData.line_items.map((lineItem, index) => (
              <div key={index} className="mb-3 rounded border border-gray-200 p-4">
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Item</label>
                    <select
                      value={lineItem.item}
                      onChange={(e) => updateLineItem(index, 'item', parseInt(e.target.value))}
                      className={`w-full rounded border px-3 py-2 ${fieldErrors[`line_items[${String(index)}].item`] ? 'border-red-500' : 'border-gray-300'}`}
                      required
                    >
                      <option value={0}>Select item...</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} {item.version}
                        </option>
                      ))}
                    </select>
                    {fieldErrors[`line_items[${String(index)}].item`] && (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors[`line_items[${String(index)}].item`]}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number"
                      value={lineItem.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value))}
                      className={`w-full rounded border px-3 py-2 ${fieldErrors[`line_items[${String(index)}].quantity`] ? 'border-red-500' : 'border-gray-300'}`}
                      min="1"
                      required
                    />
                    {fieldErrors[`line_items[${String(index)}].quantity`] && (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors[`line_items[${String(index)}].quantity`]}
                      </p>
                    )}
                  </div>
                  {allocateFromPo ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        PO Price
                      </label>
                      {lineItem.item !== 0 ? (
                        (() => {
                          const poPrice = getPoPrice(lineItem.item);
                          return poPrice ? (
                            <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
                              ${poPrice} / unit
                            </div>
                          ) : (
                            <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                              No PO available
                            </div>
                          );
                        })()
                      ) : (
                        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
                          Select an item
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Price per Unit
                      </label>
                      <input
                        type="number"
                        value={lineItem.price_per_unit ?? ''}
                        onChange={(e) => updateLineItem(index, 'price_per_unit', e.target.value)}
                        className={`w-full rounded border px-3 py-2 ${fieldErrors[`line_items[${String(index)}].price_per_unit`] ? 'border-red-500' : 'border-gray-300'}`}
                        step="0.01"
                        min="0.01"
                      />
                      {fieldErrors[`line_items[${String(index)}].price_per_unit`] && (
                        <p className="mt-1 text-sm text-red-600">
                          {fieldErrors[`line_items[${String(index)}].price_per_unit`]}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="w-full rounded bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                      onClick={() => removeLineItem(index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {formData.line_items.length === 0 && (
              <p className="text-sm text-gray-500">
                No line items. Click &quot;Add Item&quot; to get started.
              </p>
            )}
          </div>

          <div className="flex space-x-4">
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              {isEdit ? 'Update' : 'Create'} Order
            </button>
            <button
              type="button"
              className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
              onClick={() => navigate('/orders')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
