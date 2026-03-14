import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deliveriesApi, itemsApi, ordersApi } from '../../api';
import { getFulfilErrorMessage, getApiFieldErrors } from '../../types';
import type { Item, Order, Delivery, DeliveryLineItem, FieldErrors } from '../../types';
import { useAuth } from '@inator/shared/auth/AuthProvider';

interface OrderGroup {
  orderId: number | null;
  items: DeliveryLineItem[];
}

/** Form for creating or editing a Delivery with order-grouped serial-numbered items. */
export function DeliveryForm(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [formData, setFormData] = useState({
    customer_id: '',
    ship_date: new Date().toISOString().split('T')[0]!,
    tracking_number: '',
    notes: '',
    status: 'OPEN' as 'OPEN' | 'CLOSED',
    created_by_user_id: user?.username ?? '',
  });

  useEffect(() => {
    void loadItems();
    if (isEdit && id) void loadDelivery(parseInt(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  useEffect(() => {
    void loadOrders(formData.customer_id);
  }, [formData.customer_id]);

  useEffect(() => {
    if (orders.length === 0 || orderGroups.length === 0) return;
    let changed = false;
    const resolved = orderGroups.map((group) => {
      if (group.orderId !== null) return group;
      for (const item of group.items) {
        if (item.order_line_item) {
          const order = orders.find((o) =>
            o.line_items.some((oli) => oli.id === item.order_line_item),
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

  const loadItems = async (): Promise<void> => {
    try {
      setItems(await itemsApi.list());
    } catch {
      setError('Failed to load items');
    }
  };

  const loadOrders = async (customerId: string): Promise<void> => {
    try {
      const data = await ordersApi.list();
      setOrders(
        data.filter(
          (o) => o.customer_id.toLowerCase() === customerId.toLowerCase() && o.status === 'OPEN',
        ),
      );
    } catch {
      /* non-critical */
    }
  };

  const loadDelivery = async (deliveryId: number): Promise<void> => {
    try {
      setLoading(true);
      const data = await deliveriesApi.get(deliveryId);
      setFormData({
        customer_id: data.customer_id,
        ship_date: data.ship_date,
        tracking_number: data.tracking_number ?? '',
        notes: data.notes ?? '',
        status: data.status,
        created_by_user_id: data.created_by_user_id ?? user?.username ?? '',
      });
      const groupMap = new Map<string, OrderGroup>();
      for (const li of data.line_items ?? []) {
        const key = li.order_number ?? '_unlinked';
        if (!groupMap.has(key)) groupMap.set(key, { orderId: null, items: [] });
        groupMap.get(key)!.items.push(li);
      }
      setOrderGroups(Array.from(groupMap.values()));
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to load delivery'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addOrderGroup = (): void => {
    setOrderGroups([...orderGroups, { orderId: null, items: [] }]);
  };
  const removeOrderGroup = (idx: number): void => {
    setOrderGroups(orderGroups.filter((_, i) => i !== idx));
  };
  const selectOrder = (idx: number, orderId: number | null): void => {
    const updated = [...orderGroups];
    updated[idx] = { orderId, items: [] };
    setOrderGroups(updated);
  };
  const addItemToGroup = (gIdx: number): void => {
    const updated = [...orderGroups];
    updated[gIdx] = {
      ...updated[gIdx]!,
      items: [{ item: 0, serial_number: '', price_per_unit: '' }, ...updated[gIdx]!.items],
    };
    setOrderGroups(updated);
  };
  const removeItemFromGroup = (gIdx: number, iIdx: number): void => {
    const updated = [...orderGroups];
    updated[gIdx] = { ...updated[gIdx]!, items: updated[gIdx]!.items.filter((_, i) => i !== iIdx) };
    setOrderGroups(updated);
  };

  const linkOrderLineItem = (gIdx: number, iIdx: number, orderLineItemId: number | null): void => {
    const updated = [...orderGroups];
    const group = updated[gIdx]!;
    const order = orders.find((o) => o.id === group.orderId);
    if (orderLineItemId && order) {
      const oli = order.line_items.find((li) => li.id === orderLineItemId);
      if (oli) {
        updated[gIdx]!.items[iIdx] = {
          ...updated[gIdx]!.items[iIdx]!,
          order_line_item: orderLineItemId,
          item: oli.item,
          price_per_unit: oli.price_per_unit ?? updated[gIdx]!.items[iIdx]!.price_per_unit,
        };
      }
    } else {
      const { order_line_item: _unused, ...rest } = updated[gIdx]!.items[iIdx]!;
      void _unused;
      updated[gIdx]!.items[iIdx] = rest as DeliveryLineItem;
    }
    setOrderGroups(updated);
  };

  const updateItemInGroup = (
    gIdx: number,
    iIdx: number,
    field: keyof DeliveryLineItem,
    value: string | number,
  ): void => {
    const updated = [...orderGroups];
    updated[gIdx] = {
      ...updated[gIdx]!,
      items: updated[gIdx]!.items.map((item, i) =>
        i === iIdx ? { ...item, [field]: value } : item,
      ),
    };
    setOrderGroups(updated);
  };

  const flatIdx = (gIdx: number, iIdx: number): number => {
    let idx = 0;
    for (let g = 0; g < gIdx; g++) idx += orderGroups[g]!.items.length;
    return idx + iIdx;
  };

  const usedOrderIds = (excludeIdx: number): Set<number> => {
    const used = new Set<number>();
    orderGroups.forEach((g, i) => {
      if (i !== excludeIdx && g.orderId !== null) used.add(g.orderId);
    });
    return used;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const lineItems = orderGroups.flatMap((g) => g.items);
    if (lineItems.length === 0) {
      setError('At least one line item is required');
      return;
    }

    const serials = lineItems.map((li) => li.serial_number);
    const dupes = serials.filter((sn, i) => serials.indexOf(sn) !== i);
    if (dupes.length > 0) {
      setError(`Duplicate serial numbers found: ${dupes.join(', ')}`);
      return;
    }

    try {
      const submitData = { ...formData, line_items: lineItems };
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
        const lineItemErrs = Object.entries(fe).filter(([k]) => k.includes('['));
        const parts = [...topLevel];
        if (lineItemErrs.length > 0)
          parts.push(
            `${String(lineItemErrs.length)} line item error(s) — see highlighted fields below`,
          );
        setError(parts.join('. '));
      } else {
        setError(getFulfilErrorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} delivery`));
      }
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">{isEdit ? 'Edit Delivery' : 'Create Delivery'}</h1>
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="grid grid-cols-2 gap-4">
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
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="ship_date" className="mb-1 block text-sm font-medium text-gray-700">
                Ship Date <span className="text-red-500">*</span>
              </label>
              <input
                id="ship_date"
                name="ship_date"
                type="date"
                value={formData.ship_date}
                onChange={handleChange}
                required
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mb-4">
            <label
              htmlFor="tracking_number"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Tracking Number
            </label>
            <input
              id="tracking_number"
              name="tracking_number"
              value={formData.tracking_number}
              onChange={handleChange}
              placeholder="e.g., TRACK123456"
              className={`w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 ${fieldErrors.tracking_number ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
            />
            {fieldErrors.tracking_number && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.tracking_number}</p>
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

          {/* Order Groups */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium">Orders &amp; Items</h3>
              <button
                type="button"
                onClick={addOrderGroup}
                disabled={orders.length === 0}
                className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add Order
              </button>
            </div>

            {orders.length === 0 && (
              <div className="mb-3 rounded border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm text-yellow-800">
                  <strong>No open orders found</strong> for this customer. Create an order before
                  adding items to a delivery.
                </p>
              </div>
            )}

            {orderGroups.map((group, gIdx) => {
              const selectedOrder = orders.find((o) => o.id === group.orderId);
              const used = usedOrderIds(gIdx);
              const availableOrders = orders.filter((o) => !used.has(o.id));

              return (
                <div
                  key={gIdx}
                  className="mb-4 rounded-lg border-2 border-blue-200 bg-blue-50/30 p-4"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Order *
                      </label>
                      <select
                        value={group.orderId ?? ''}
                        onChange={(e) =>
                          selectOrder(gIdx, e.target.value ? parseInt(e.target.value) : null)
                        }
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        data-testid={`order-select-${String(gIdx)}`}
                      >
                        <option value="">Select an order…</option>
                        {availableOrders.map((order) => (
                          <option key={order.id} value={order.id}>
                            {order.order_number} — {order.line_items.length} line item(s)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        className="rounded bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                        onClick={() => removeOrderGroup(gIdx)}
                      >
                        Remove Order
                      </button>
                    </div>
                  </div>

                  {(group.orderId !== null || group.items.length > 0) && (
                    <>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">Items</span>
                        <button
                          type="button"
                          onClick={() => addItemToGroup(gIdx)}
                          disabled={group.orderId === null}
                          className="rounded bg-gray-200 px-3 py-1 text-sm font-medium text-gray-800 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add Item
                        </button>
                      </div>

                      {group.items.map((lineItem, iIdx) => {
                        const fi = flatIdx(gIdx, iIdx);
                        return (
                          <div
                            key={iIdx}
                            className="mb-2 rounded border border-gray-200 bg-white p-3"
                          >
                            {selectedOrder && (
                              <div className="mb-2">
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                  Order Line Item *
                                </label>
                                <select
                                  value={lineItem.order_line_item ?? ''}
                                  onChange={(e) =>
                                    linkOrderLineItem(
                                      gIdx,
                                      iIdx,
                                      e.target.value ? parseInt(e.target.value) : null,
                                    )
                                  }
                                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                  data-testid={`item-type-${String(gIdx)}-${String(iIdx)}`}
                                >
                                  <option value="">Select order line item…</option>
                                  {selectedOrder.line_items.map((oli) => (
                                    <option key={oli.id} value={oli.id}>
                                      {oli.item_name ??
                                        items.find((i) => i.id === oli.item)?.name ??
                                        `Item #${String(oli.item)}`}{' '}
                                      × {oli.quantity} @ ${oli.price_per_unit}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div
                              className={`grid gap-3 ${lineItem.order_line_item ? 'grid-cols-3' : 'grid-cols-4'}`}
                            >
                              {!lineItem.order_line_item && (
                                <div>
                                  <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Item
                                  </label>
                                  <select
                                    value={lineItem.item}
                                    onChange={(e) =>
                                      updateItemInGroup(
                                        gIdx,
                                        iIdx,
                                        'item',
                                        parseInt(e.target.value),
                                      )
                                    }
                                    className={`w-full rounded border px-3 py-2 ${fieldErrors[`line_items[${String(fi)}].item`] ? 'border-red-500' : 'border-gray-300'}`}
                                  >
                                    <option value={0}>Select item…</option>
                                    {items.map((item) => (
                                      <option key={item.id} value={item.id}>
                                        {item.name} {item.version}
                                      </option>
                                    ))}
                                  </select>
                                  {fieldErrors[`line_items[${String(fi)}].item`] && (
                                    <p className="mt-1 text-sm text-red-600">
                                      {fieldErrors[`line_items[${String(fi)}].item`]}
                                    </p>
                                  )}
                                </div>
                              )}
                              <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                  Serial Number *
                                </label>
                                <input
                                  type="text"
                                  value={lineItem.serial_number}
                                  onChange={(e) =>
                                    updateItemInGroup(gIdx, iIdx, 'serial_number', e.target.value)
                                  }
                                  className={`w-full rounded border px-3 py-2 ${fieldErrors[`line_items[${String(fi)}].serial_number`] ? 'border-red-500' : 'border-gray-300'}`}
                                  placeholder="SN123456"
                                />
                                {fieldErrors[`line_items[${String(fi)}].serial_number`] && (
                                  <p className="mt-1 text-sm text-red-600">
                                    {fieldErrors[`line_items[${String(fi)}].serial_number`]}
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                  Price per Unit
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={lineItem.price_per_unit}
                                  onChange={(e) =>
                                    updateItemInGroup(gIdx, iIdx, 'price_per_unit', e.target.value)
                                  }
                                  className={`w-full rounded border px-3 py-2 ${fieldErrors[`line_items[${String(fi)}].price_per_unit`] ? 'border-red-500' : 'border-gray-300'}`}
                                  disabled={!!lineItem.order_line_item}
                                  min="0.01"
                                />
                                {fieldErrors[`line_items[${String(fi)}].price_per_unit`] && (
                                  <p className="mt-1 text-sm text-red-600">
                                    {fieldErrors[`line_items[${String(fi)}].price_per_unit`]}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-end">
                                <button
                                  type="button"
                                  className="w-full rounded bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                                  onClick={() => removeItemFromGroup(gIdx, iIdx)}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {group.items.length === 0 && (
                        <p className="py-2 text-sm text-gray-500">
                          No items yet. Click &quot;Add Item&quot; to add items from this order.
                        </p>
                      )}
                    </>
                  )}
                  {group.orderId === null && group.items.length === 0 && (
                    <p className="text-sm text-gray-400">
                      Select an order above to start adding items.
                    </p>
                  )}
                </div>
              );
            })}
            {orderGroups.length === 0 && (
              <p className="text-sm text-gray-500">
                No orders added. Click &quot;Add Order&quot; to get started.
              </p>
            )}
          </div>

          <div className="flex space-x-4">
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              {isEdit ? 'Update' : 'Create'} Delivery
            </button>
            <button
              type="button"
              className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
              onClick={() => navigate('/deliveries')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
