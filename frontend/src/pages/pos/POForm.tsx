import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { posApi } from '../../api/pos';
import { itemsApi } from '../../api/items';
import { getApiErrorMessage, Item, POLineItem, PurchaseOrder } from '../../api/types';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import AttachmentList from '../../components/AttachmentList';

const POForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [formData, setFormData] = useState({
    customer_id: 'cust-123',
    start_date: '',
    expiration_date: '',
    notes: '',
    google_doc_url: '',
    hubspot_url: '',
    status: 'OPEN' as 'OPEN' | 'CLOSED',
    created_by_user_id: 'user-001',
    line_items: [] as POLineItem[],
  });

  useEffect(() => {
    loadItems();
    if (isEdit && id) {
      loadPO(parseInt(id));
    }
  }, [id, isEdit]);

  const loadItems = async () => {
    try {
      const data = await itemsApi.list();
      setItems(data);
    } catch {
      setError('Failed to load items');
    }
  };

  const loadPO = async (poId: number) => {
    try {
      setLoading(true);
      const data = await posApi.get(poId);
      setFormData({
        customer_id: data.customer_id,
        start_date: data.start_date || '',
        expiration_date: data.expiration_date || '',
        notes: data.notes || '',
        google_doc_url: data.google_doc_url || '',
        hubspot_url: data.hubspot_url || '',
        status: data.status,
        created_by_user_id: data.created_by_user_id || 'user-001',
        line_items: data.line_items || [],
      });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load PO'));
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
      line_items: [{ item: 0, quantity: 1, price_per_unit: '0', notes: '' }, ...formData.line_items],
    });
  };

  const updateLineItem = (index: number, field: keyof POLineItem, value: string | number) => {
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

    if (formData.line_items.length === 0) {
      setError('At least one line item is required');
      return;
    }

    try {
      if (isEdit && id) {
        await posApi.update(parseInt(id), formData);
      } else {
        await posApi.create(formData as Omit<PurchaseOrder, 'id' | 'po_number'>);
      }
      navigate('/pos');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} PO`));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">{isEdit ? 'Edit Purchase Order' : 'Create Purchase Order'}</h1>

      {error && <ErrorMessage message={error} />}

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <FormField
            label="Customer ID"
            name="customer_id"
            value={formData.customer_id}
            onChange={handleChange}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Start Date"
              name="start_date"
              type="date"
              value={formData.start_date}
              onChange={handleChange}
            />
            <FormField
              label="Expiration Date"
              name="expiration_date"
              type="date"
              value={formData.expiration_date}
              onChange={handleChange}
            />
          </div>

          <FormField
            label="Google Doc URL"
            name="google_doc_url"
            value={formData.google_doc_url}
            onChange={handleChange}
            placeholder="https://docs.google.com/..."
          />

          <FormField
            label="HubSpot URL"
            name="hubspot_url"
            value={formData.hubspot_url}
            onChange={handleChange}
            placeholder="https://app.hubspot.com/..."
          />

          <FormField
            label="Notes"
            name="notes"
            type="textarea"
            value={formData.notes}
            onChange={handleChange}
          />

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
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                      required
                    >
                      <option value={0}>Select item...</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} {item.version}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={lineItem.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                      min="1"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price per Unit</label>
                    <input
                      type="number"
                      step="0.01"
                      value={lineItem.price_per_unit}
                      onChange={(e) => updateLineItem(index, 'price_per_unit', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                      required
                    />
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
            <Button type="submit">{isEdit ? 'Update' : 'Create'} PO</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/pos')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>

      {isEdit && id && (
        <div className="mt-6">
          <AttachmentList contentType="PO" objectId={parseInt(id)} />
        </div>
      )}
    </div>
  );
};

export default POForm;
