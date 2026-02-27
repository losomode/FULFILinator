import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ordersApi } from '../../api/orders';
import { itemsApi } from '../../api/items';
import { posApi } from '../../api/pos';
import { getApiErrorMessage, getApiFieldErrors, FieldErrors, Item, Order, OrderLineItem, PurchaseOrder } from '../../api/types';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';

const OrderForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [items, setItems] = useState<Item[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [showAllocationPreview, setShowAllocationPreview] = useState(false);
  const [allocateFromPo, setAllocateFromPo] = useState(true);
  const [formData, setFormData] = useState({
    customer_id: 'cust-123',
    notes: '',
    status: 'OPEN' as 'OPEN' | 'CLOSED',
    created_by_user_id: 'user-001',
    line_items: [] as OrderLineItem[],
  });

  useEffect(() => {
    loadItems();
    if (isEdit && id) {
      loadOrder(parseInt(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  useEffect(() => {
    loadPOs(formData.customer_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.customer_id]);

  const loadItems = async () => {
    try {
      const data = await itemsApi.list();
      setItems(data);
    } catch {
      setError('Failed to load items');
    }
  };

  const loadPOs = async (customerId: string) => {
    try {
      const data = await posApi.list();
      // Filter to customer's open POs (case-insensitive), sorted oldest-first to match allocation order
      const filtered = data
        .filter(po => po.customer_id.toLowerCase() === customerId.toLowerCase() && po.status === 'OPEN')
        .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
      setPos(filtered);
    } catch {
      // Non-critical
    }
  };

  /** Look up the PO price for an item (from the oldest PO with availability, matching allocation order). */
  const getPoPrice = (itemId: number): string | null => {
    for (const po of pos) {
      if (po.fulfillment_status) {
        const li = po.fulfillment_status.line_items.find(
          fl => fl.item_id === itemId && fl.remaining_quantity > 0
        );
        if (li) return li.price_per_unit;
      }
    }
    return null;
  };

  const loadOrder = async (orderId: number) => {
    try {
      setLoading(true);
      const data = await ordersApi.get(orderId);
      setFormData({
        customer_id: data.customer_id,
        notes: data.notes || '',
        status: data.status,
        created_by_user_id: data.created_by_user_id || 'user-001',
        line_items: data.line_items || [],
      });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load order'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [{ item: 0, quantity: 1 }, ...formData.line_items],
    });
  };

  const updateLineItem = (index: number, field: keyof OrderLineItem, value: string | number) => {
    const updatedItems = [...formData.line_items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setFormData({ ...formData, line_items: updatedItems });
  };

  const removeLineItem = (index: number) => {
    setFormData({
      ...formData,
      line_items: formData.line_items.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
        await ordersApi.create({
          ...formData,
          allocate_from_po: allocateFromPo,
        } as Omit<Order, 'id' | 'order_number'> & { allocate_from_po: boolean });
      }
      navigate('/orders');
    } catch (err: unknown) {
      const fe = getApiFieldErrors(err);
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        const topLevel = Object.entries(fe)
          .filter(([k]) => !k.includes('['))
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
        const lineItemErrors = Object.entries(fe)
          .filter(([k]) => k.includes('['));
        const parts = [...topLevel];
        if (lineItemErrors.length > 0) {
          parts.push(`${lineItemErrors.length} line item error(s) — see highlighted fields below`);
        }
        setError(parts.join('. '));
      } else {
        setError(getApiErrorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} order`));
      }
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">{isEdit ? 'Edit Order' : 'Create Order'}</h1>

      {error && <ErrorMessage message={error} />}

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <FormField
            label="Customer ID"
            name="customer_id"
            value={formData.customer_id}
            onChange={handleChange}
            required
            error={fieldErrors.customer_id}
          />

          <FormField
            label="Notes"
            name="notes"
            type="textarea"
            value={formData.notes}
            onChange={handleChange}
            error={fieldErrors.notes}
          />

          {!isEdit && (
            <>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center mb-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allocateFromPo}
                      onChange={(e) => setAllocateFromPo(e.target.checked)}
                      className="mr-2"
                    />
                    <strong className="text-sm text-blue-800">Automatic PO Allocation</strong>
                  </label>
                </div>
                {allocateFromPo && (
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-blue-800">
                      The system will automatically allocate items from the oldest available Purchase Orders
                      (by start date) for this customer.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-sm"
                      onClick={() => setShowAllocationPreview(!showAllocationPreview)}
                    >
                      {showAllocationPreview ? 'Hide' : 'Show'} Preview
                    </Button>
                  </div>
                )}
                {!allocateFromPo && (
                  <p className="text-sm text-blue-800">
                    Ad-hoc order — you must specify a price per unit for each line item.
                  </p>
                )}
              </div>
              
              {allocateFromPo && showAllocationPreview && (
                <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded">
                  <h4 className="text-sm font-semibold mb-3">Available POs for Allocation</h4>
                  {pos.length === 0 ? (
                    <p className="text-sm text-gray-600">No open POs found for customer {formData.customer_id}</p>
                  ) : (
                    <div className="space-y-3">
                      {pos.map(po => (
                        <div key={po.id} className="bg-white p-3 rounded border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium text-sm">{po.po_number}</span>
                              {po.start_date && (
                                <span className="text-xs text-gray-500 ml-2">Start: {po.start_date}</span>
                              )}
                            </div>
                          </div>
                          {po.fulfillment_status && po.fulfillment_status.line_items.length > 0 && (
                            <div className="text-xs space-y-1">
                              {po.fulfillment_status.line_items.map((item, idx) => {
                                const remaining = item.remaining_quantity;
                                if (remaining === 0) return null;
                                return (
                                  <div key={idx} className="flex justify-between text-gray-700">
                                    <span>{item.item_name}</span>
                                    <span className="font-medium">{remaining} available</span>
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
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium">Line Items</h3>
              <Button type="button" onClick={addLineItem} variant="secondary">
                Add Item
              </Button>
            </div>

            {formData.line_items.map((lineItem, index) => (
              <div key={index} className="border border-gray-200 rounded p-4 mb-3">
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                    <select
                      value={lineItem.item}
                      onChange={(e) => updateLineItem(index, 'item', parseInt(e.target.value))}
                      className={`w-full px-3 py-2 border rounded ${
                        fieldErrors[`line_items[${index}].item`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                    >
                      <option value={0}>Select item...</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} {item.version}
                        </option>
                      ))}
                    </select>
                    {fieldErrors[`line_items[${index}].item`] && (
                      <p className="mt-1 text-sm text-red-600">{fieldErrors[`line_items[${index}].item`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={lineItem.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value))}
                      className={`w-full px-3 py-2 border rounded ${
                        fieldErrors[`line_items[${index}].quantity`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      min="1"
                      required
                    />
                    {fieldErrors[`line_items[${index}].quantity`] && (
                      <p className="mt-1 text-sm text-red-600">{fieldErrors[`line_items[${index}].quantity`]}</p>
                    )}
                  </div>

                  {allocateFromPo ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PO Price</label>
                      {lineItem.item !== 0 ? (() => {
                        const poPrice = getPoPrice(lineItem.item);
                        return poPrice ? (
                          <div className="px-3 py-2 bg-green-50 border border-green-200 rounded text-sm font-medium text-green-800">
                            ${poPrice} / unit
                          </div>
                        ) : (
                          <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                            No PO available
                          </div>
                        );
                      })() : (
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-400">
                          Select an item
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price per Unit</label>
                      <input
                        type="number"
                        value={lineItem.price_per_unit || ''}
                        onChange={(e) => updateLineItem(index, 'price_per_unit', e.target.value)}
                        className={`w-full px-3 py-2 border rounded ${
                          fieldErrors[`line_items[${index}].price_per_unit`] ? 'border-red-500' : 'border-gray-300'
                        }`}
                        step="0.01"
                        min="0.01"
                        required
                      />
                      {fieldErrors[`line_items[${index}].price_per_unit`] && (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors[`line_items[${index}].price_per_unit`]}</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => removeLineItem(index)}
                      className="w-full"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {formData.line_items.length === 0 && (
              <p className="text-gray-500 text-sm">No line items. Click "Add Item" to get started.</p>
            )}
          </div>

          <div className="flex space-x-4">
            <Button type="submit">{isEdit ? 'Update' : 'Create'} Order</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/orders')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderForm;
