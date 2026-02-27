import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deliveriesApi } from '../../api/deliveries';
import { itemsApi } from '../../api/items';
import { ordersApi } from '../../api/orders';
import { getApiErrorMessage, getApiFieldErrors, FieldErrors, Item, Order, Delivery, DeliveryLineItem } from '../../api/types';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';

interface OrderGroup {
  orderId: number | null;
  items: DeliveryLineItem[];
}

const DeliveryForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [formData, setFormData] = useState({
    customer_id: 'cust-123',
    ship_date: new Date().toISOString().split('T')[0],
    tracking_number: '',
    notes: '',
    status: 'OPEN' as 'OPEN' | 'CLOSED',
    created_by_user_id: 'user-001',
  });

  useEffect(() => {
    loadItems();
    if (isEdit && id) {
      loadDelivery(parseInt(id));
    }
  }, [id, isEdit]);

  useEffect(() => {
    loadOrders(formData.customer_id);
  }, [formData.customer_id]);

  // Resolve order IDs in groups once orders load (edit mode)
  useEffect(() => {
    if (orders.length === 0 || orderGroups.length === 0) return;
    let changed = false;
    const resolved = orderGroups.map(group => {
      if (group.orderId !== null) return group;
      for (const item of group.items) {
        if (item.order_line_item) {
          const order = orders.find(o =>
            o.line_items.some(oli => oli.id === item.order_line_item)
          );
          if (order) {
            changed = true;
            return { ...group, orderId: order.id };
          }
        }
      }
      return group;
    });
    if (changed) setOrderGroups(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const loadItems = async () => {
    try {
      const data = await itemsApi.list();
      setItems(data);
    } catch {
      setError('Failed to load items');
    }
  };

  const loadOrders = async (customerId: string) => {
    try {
      const data = await ordersApi.list();
      setOrders(data.filter(o => o.customer_id.toLowerCase() === customerId.toLowerCase() && o.status === 'OPEN'));
    } catch {
      // Non-critical
    }
  };

  const loadDelivery = async (deliveryId: number) => {
    try {
      setLoading(true);
      const data = await deliveriesApi.get(deliveryId);
      setFormData({
        customer_id: data.customer_id,
        ship_date: data.ship_date,
        tracking_number: data.tracking_number || '',
        notes: data.notes || '',
        status: data.status,
        created_by_user_id: data.created_by_user_id || 'user-001',
      });
      // Reconstruct order groups from flat line items
      const groupMap = new Map<string, OrderGroup>();
      for (const li of data.line_items || []) {
        const key = li.order_number || '_unlinked';
        if (!groupMap.has(key)) {
          groupMap.set(key, { orderId: null, items: [] });
        }
        groupMap.get(key)!.items.push(li);
      }
      setOrderGroups(Array.from(groupMap.values()));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load delivery'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  /* ---- Order group operations ---- */

  const addOrderGroup = () => {
    setOrderGroups([...orderGroups, { orderId: null, items: [] }]);
  };

  const removeOrderGroup = (groupIdx: number) => {
    setOrderGroups(orderGroups.filter((_, i) => i !== groupIdx));
  };

  const selectOrder = (groupIdx: number, orderId: number | null) => {
    const updated = [...orderGroups];
    updated[groupIdx] = { orderId, items: [] };
    setOrderGroups(updated);
  };

  const addItemToGroup = (groupIdx: number) => {
    const updated = [...orderGroups];
    updated[groupIdx] = {
      ...updated[groupIdx],
      items: [{ item: 0, serial_number: '', price_per_unit: '' }, ...updated[groupIdx].items],
    };
    setOrderGroups(updated);
  };

  const removeItemFromGroup = (groupIdx: number, itemIdx: number) => {
    const updated = [...orderGroups];
    updated[groupIdx] = {
      ...updated[groupIdx],
      items: updated[groupIdx].items.filter((_, i) => i !== itemIdx),
    };
    setOrderGroups(updated);
  };

  const linkOrderLineItem = (groupIdx: number, itemIdx: number, orderLineItemId: number | null) => {
    const updated = [...orderGroups];
    const group = updated[groupIdx];
    const order = orders.find(o => o.id === group.orderId);

    if (orderLineItemId && order) {
      const oli = order.line_items.find(li => li.id === orderLineItemId);
      if (oli) {
        updated[groupIdx].items[itemIdx] = {
          ...updated[groupIdx].items[itemIdx],
          order_line_item: orderLineItemId,
          item: oli.item,
          price_per_unit: oli.price_per_unit || updated[groupIdx].items[itemIdx].price_per_unit,
        };
      }
    } else {
      const { order_line_item: _, ...rest } = updated[groupIdx].items[itemIdx];
      updated[groupIdx].items[itemIdx] = rest;
    }
    setOrderGroups(updated);
  };

  const updateItemInGroup = (groupIdx: number, itemIdx: number, field: keyof DeliveryLineItem, value: string | number) => {
    const updated = [...orderGroups];
    updated[groupIdx] = {
      ...updated[groupIdx],
      items: updated[groupIdx].items.map((item, i) =>
        i === itemIdx ? { ...item, [field]: value } : item
      ),
    };
    setOrderGroups(updated);
  };

  /** Flat index of a grouped item (for field-error mapping). */
  const flatIdx = (groupIdx: number, itemIdx: number): number => {
    let idx = 0;
    for (let g = 0; g < groupIdx; g++) idx += orderGroups[g].items.length;
    return idx + itemIdx;
  };

  /** Order IDs already chosen in other groups. */
  const usedOrderIds = (excludeGroupIdx: number): Set<number> => {
    const used = new Set<number>();
    orderGroups.forEach((g, i) => {
      if (i !== excludeGroupIdx && g.orderId !== null) used.add(g.orderId);
    });
    return used;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const lineItems = orderGroups.flatMap(g => g.items);

    if (lineItems.length === 0) {
      setError('At least one line item is required');
      return;
    }

    const serialNumbers = lineItems.map(li => li.serial_number);
    const duplicates = serialNumbers.filter((sn, index) => serialNumbers.indexOf(sn) !== index);
    if (duplicates.length > 0) {
      setError(`Duplicate serial numbers found: ${duplicates.join(', ')}`);
      return;
    }

    const submitData = { ...formData, line_items: lineItems };

    try {
      if (isEdit && id) {
        await deliveriesApi.update(parseInt(id), submitData);
      } else {
        await deliveriesApi.create(submitData as Omit<Delivery, 'id' | 'delivery_number'>);
      }
      navigate('/deliveries');
    } catch (err: unknown) {
      const fe = getApiFieldErrors(err);
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        const topLevel = Object.entries(fe)
          .filter(([k]) => !k.includes('['))
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
        const lineItemErrors = Object.entries(fe).filter(([k]) => k.includes('['));
        const parts = [...topLevel];
        if (lineItemErrors.length > 0) {
          parts.push(`${lineItemErrors.length} line item error(s) — see highlighted fields below`);
        }
        setError(parts.join('. '));
      } else {
        setError(getApiErrorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} delivery`));
      }
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">{isEdit ? 'Edit Delivery' : 'Create Delivery'}</h1>

      {error && <ErrorMessage message={error} />}

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Customer ID" name="customer_id" value={formData.customer_id} onChange={handleChange} required />
            <FormField label="Ship Date" name="ship_date" type="date" value={formData.ship_date} onChange={handleChange} required />
          </div>

          <FormField
            label="Tracking Number"
            name="tracking_number"
            value={formData.tracking_number}
            onChange={handleChange}
            placeholder="e.g., TRACK123456"
            error={fieldErrors.tracking_number}
          />

          <FormField label="Notes" name="notes" type="textarea" value={formData.notes} onChange={handleChange} />

          {/* ---- Order Groups ---- */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium">Orders &amp; Items</h3>
              <Button type="button" onClick={addOrderGroup} variant="secondary" disabled={orders.length === 0}>
                Add Order
              </Button>
            </div>

            {orders.length === 0 && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  <strong>No open orders found</strong> for this customer. Create an order before adding items to a delivery.
                </p>
              </div>
            )}

            {orderGroups.map((group, groupIdx) => {
              const selectedOrder = orders.find(o => o.id === group.orderId);
              const used = usedOrderIds(groupIdx);
              const availableOrders = orders.filter(o => !used.has(o.id));

              return (
                <div key={groupIdx} className="border-2 border-blue-200 rounded-lg p-4 mb-4 bg-blue-50/30">
                  {/* Order selector */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Order *</label>
                      <select
                        value={group.orderId ?? ''}
                        onChange={(e) => selectOrder(groupIdx, e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        data-testid={`order-select-${groupIdx}`}
                      >
<option value="">Select an order…</option>
                        {availableOrders.map(order => (
                          <option key={order.id} value={order.id}>
                            {order.order_number} — {order.line_items.length} line item(s)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="danger" onClick={() => removeOrderGroup(groupIdx)}>
                        Remove Order
                      </Button>
                    </div>
                  </div>

                  {/* Items within this order */}
                  {(group.orderId !== null || group.items.length > 0) && (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600">Items</span>
                        <Button
                          type="button"
                          onClick={() => addItemToGroup(groupIdx)}
                          variant="secondary"
                          className="text-sm px-3 py-1"
                          disabled={group.orderId === null}
                        >
                          Add Item
                        </Button>
                      </div>

                      {group.items.map((lineItem, itemIdx) => {
                        const fi = flatIdx(groupIdx, itemIdx);
                        return (
                          <div key={itemIdx} className="border border-gray-200 rounded p-3 mb-2 bg-white">
                            {selectedOrder && (
                              <div className="mb-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Item Type *</label>
                                <select
                                  value={lineItem.order_line_item || ''}
                                  onChange={(e) => linkOrderLineItem(groupIdx, itemIdx, e.target.value ? parseInt(e.target.value) : null)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                  data-testid={`item-type-${groupIdx}-${itemIdx}`}
                                  required
                                >
<option value="">Select item type…</option>
                                  {selectedOrder.line_items.map(oli => (
                                    <option key={oli.id} value={oli.id}>
                                      {oli.item_name || items.find(i => i.id === oli.item)?.name || `Item #${oli.item}`} × {oli.quantity} @ ${oli.price_per_unit}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="grid grid-cols-4 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                                <select
                                  value={lineItem.item}
                                  onChange={(e) => updateItemInGroup(groupIdx, itemIdx, 'item', parseInt(e.target.value))}
                                  className={`w-full px-3 py-2 border rounded ${
                                    fieldErrors[`line_items[${fi}].item`] ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                  disabled={!!lineItem.order_line_item}
                                  required
                                >
<option value={0}>Select item…</option>
                                  {items.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name} {item.version}</option>
                                  ))}
                                </select>
                                {fieldErrors[`line_items[${fi}].item`] && (
                                  <p className="mt-1 text-sm text-red-600">{fieldErrors[`line_items[${fi}].item`]}</p>
                                )}
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
                                <input
                                  type="text"
                                  value={lineItem.serial_number}
                                  onChange={(e) => updateItemInGroup(groupIdx, itemIdx, 'serial_number', e.target.value)}
                                  className={`w-full px-3 py-2 border rounded ${
                                    fieldErrors[`line_items[${fi}].serial_number`] ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                  placeholder="SN123456"
                                  required
                                />
                                {fieldErrors[`line_items[${fi}].serial_number`] && (
                                  <p className="mt-1 text-sm text-red-600">{fieldErrors[`line_items[${fi}].serial_number`]}</p>
                                )}
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Price per Unit</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={lineItem.price_per_unit}
                                  onChange={(e) => updateItemInGroup(groupIdx, itemIdx, 'price_per_unit', e.target.value)}
                                  className={`w-full px-3 py-2 border rounded ${
                                    fieldErrors[`line_items[${fi}].price_per_unit`] ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                  disabled={!!lineItem.order_line_item}
                                  min="0.01"
                                  required
                                />
                                {fieldErrors[`line_items[${fi}].price_per_unit`] && (
                                  <p className="mt-1 text-sm text-red-600">{fieldErrors[`line_items[${fi}].price_per_unit`]}</p>
                                )}
                              </div>

                              <div className="flex items-end">
                                <Button type="button" variant="danger" onClick={() => removeItemFromGroup(groupIdx, itemIdx)} className="w-full">
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {group.items.length === 0 && (
                        <p className="text-gray-500 text-sm py-2">No items yet. Click &quot;Add Item&quot; to add items from this order.</p>
                      )}
                    </>
                  )}

                  {group.orderId === null && group.items.length === 0 && (
                    <p className="text-gray-400 text-sm">Select an order above to start adding items.</p>
                  )}
                </div>
              );
            })}

            {orderGroups.length === 0 && (
              <p className="text-gray-500 text-sm">No orders added. Click &quot;Add Order&quot; to get started.</p>
            )}
          </div>

          <div className="flex space-x-4">
            <Button type="submit">{isEdit ? 'Update' : 'Create'} Delivery</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/deliveries')}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeliveryForm;
