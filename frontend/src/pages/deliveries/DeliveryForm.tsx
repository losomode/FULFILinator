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

const DeliveryForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [formData, setFormData] = useState({
    customer_id: 'cust-123',
    ship_date: new Date().toISOString().split('T')[0],
    tracking_number: '',
    notes: '',
    status: 'OPEN' as 'OPEN' | 'CLOSED',
    created_by_user_id: 'user-001',
    line_items: [] as DeliveryLineItem[],
  });

  useEffect(() => {
    loadItems();
    if (isEdit && id) {
      loadDelivery(parseInt(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  useEffect(() => {
    loadOrders(formData.customer_id);
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
        line_items: data.line_items || [],
      });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load delivery'));
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
      line_items: [{ item: 0, serial_number: '', price_per_unit: '' }, ...formData.line_items],
    });
  };

  const linkToOrderLineItem = (index: number, orderLineItemId: number | null) => {
    const updatedItems = [...formData.line_items];
    if (orderLineItemId) {
      for (const order of orders) {
        const oli = order.line_items.find(li => li.id === orderLineItemId);
        if (oli) {
          updatedItems[index] = {
            ...updatedItems[index],
            order_line_item: orderLineItemId,
            item: oli.item,
            price_per_unit: oli.price_per_unit || updatedItems[index].price_per_unit,
          };
          break;
        }
      }
    } else {
      const { order_line_item: _, ...rest } = updatedItems[index];
      updatedItems[index] = rest;
    }
    setFormData({ ...formData, line_items: updatedItems });
  };

  const updateLineItem = (index: number, field: keyof DeliveryLineItem, value: string | number) => {
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

    // Check for duplicate serial numbers
    const serialNumbers = formData.line_items.map(li => li.serial_number);
    const duplicates = serialNumbers.filter((sn, index) => serialNumbers.indexOf(sn) !== index);
    if (duplicates.length > 0) {
      setError(`Duplicate serial numbers found: ${duplicates.join(', ')}`);
      return;
    }

    try {
      if (isEdit && id) {
        await deliveriesApi.update(parseInt(id), formData);
      } else {
        await deliveriesApi.create(formData as Omit<Delivery, 'id' | 'delivery_number'>);
      }
      navigate('/deliveries');
    } catch (err: unknown) {
      const fe = getApiFieldErrors(err);
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        // Build a summary message listing which fields have errors
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
            <FormField
              label="Customer ID"
              name="customer_id"
              value={formData.customer_id}
              onChange={handleChange}
              required
            />
            <FormField
              label="Ship Date"
              name="ship_date"
              type="date"
              value={formData.ship_date}
              onChange={handleChange}
              required
            />
          </div>

          <FormField
            label="Tracking Number"
            name="tracking_number"
            value={formData.tracking_number}
            onChange={handleChange}
            placeholder="e.g., TRACK123456"
            error={fieldErrors.tracking_number}
          />

          <FormField
            label="Notes"
            name="notes"
            type="textarea"
            value={formData.notes}
            onChange={handleChange}
          />

          {/* Line Items with Serial Numbers */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium">Line Items (with Serial Numbers)</h3>
              <Button type="button" onClick={addLineItem} variant="secondary">
                Add Item
              </Button>
            </div>

            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Each line item must be linked to an order. Each physical item
                requires a unique serial number. If you need to deliver items without an existing order,
                create an ad-hoc order first.
              </p>
            </div>

            {formData.line_items.map((lineItem, index) => (
              <div key={index} className="border border-gray-200 rounded p-4 mb-3">
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Line Item *</label>
                  {orders.length > 0 ? (
                    <select
                      value={lineItem.order_line_item || ''}
                      onChange={(e) => linkToOrderLineItem(index, e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      required
                    >
                      <option value="">Select order line item...</option>
                      {orders.map(order =>
                        order.line_items.map(oli => (
                          <option key={oli.id} value={oli.id}>
                            {order.order_number} — {oli.item_name || items.find(i => i.id === oli.item)?.name || `Item #${oli.item}`} x {oli.quantity} @ ${oli.price_per_unit}
                          </option>
                        ))
                      )}
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      No open orders found for this customer. Create an order first.
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                    <select
                      value={lineItem.item}
                      onChange={(e) => updateLineItem(index, 'item', parseInt(e.target.value))}
                      className={`w-full px-3 py-2 border rounded ${
                        fieldErrors[`line_items[${index}].item`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      disabled={!!lineItem.order_line_item}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
                    <input
                      type="text"
                      value={lineItem.serial_number}
                      onChange={(e) => updateLineItem(index, 'serial_number', e.target.value)}
                      className={`w-full px-3 py-2 border rounded ${
                        fieldErrors[`line_items[${index}].serial_number`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="SN123456"
                      required
                    />
                    {fieldErrors[`line_items[${index}].serial_number`] && (
                      <p className="mt-1 text-sm text-red-600">{fieldErrors[`line_items[${index}].serial_number`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price per Unit</label>
                    <input
                      type="number"
                      step="0.01"
                      value={lineItem.price_per_unit}
                      onChange={(e) => updateLineItem(index, 'price_per_unit', e.target.value)}
                      className={`w-full px-3 py-2 border rounded ${
                        fieldErrors[`line_items[${index}].price_per_unit`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      disabled={!!lineItem.order_line_item}
                      min="0.01"
                      required
                    />
                    {fieldErrors[`line_items[${index}].price_per_unit`] && (
                      <p className="mt-1 text-sm text-red-600">{fieldErrors[`line_items[${index}].price_per_unit`]}</p>
                    )}
                  </div>

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
            <Button type="submit">{isEdit ? 'Update' : 'Create'} Delivery</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/deliveries')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeliveryForm;
