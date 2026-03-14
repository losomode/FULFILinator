import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { posApi, itemsApi } from '../../api';
import { getFulfilErrorMessage } from '../../types';
import type { Item, POLineItem, PurchaseOrder } from '../../types';
import { useAuth } from '@inator/shared/auth/AuthProvider';
import { AttachmentList } from '../../components/AttachmentList';

/** Form for creating or editing a Purchase Order with line items. */
export function POForm(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [formData, setFormData] = useState({
    customer_id: '',
    start_date: '',
    expiration_date: '',
    notes: '',
    google_doc_url: '',
    hubspot_url: '',
    status: 'OPEN' as 'OPEN' | 'CLOSED',
    created_by_user_id: user?.username ?? '',
    line_items: [] as POLineItem[],
  });

  useEffect(() => {
    void loadItems();
    if (isEdit && id) {
      void loadPO(parseInt(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const loadItems = async (): Promise<void> => {
    try {
      const data = await itemsApi.list();
      setItems(data);
    } catch {
      setError('Failed to load items');
    }
  };

  const loadPO = async (poId: number): Promise<void> => {
    try {
      setLoading(true);
      const data = await posApi.get(poId);
      setFormData({
        customer_id: data.customer_id,
        start_date: data.start_date ?? '',
        expiration_date: data.expiration_date ?? '',
        notes: data.notes ?? '',
        google_doc_url: data.google_doc_url ?? '',
        hubspot_url: data.hubspot_url ?? '',
        status: data.status,
        created_by_user_id: data.created_by_user_id ?? user?.username ?? '',
        line_items: data.line_items ?? [],
      });
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to load PO'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addLineItem = (): void => {
    setFormData({
      ...formData,
      line_items: [
        { item: 0, quantity: 1, price_per_unit: '0', notes: '' },
        ...formData.line_items,
      ],
    });
  };

  const updateLineItem = (index: number, field: keyof POLineItem, value: string | number): void => {
    const updatedItems = [...formData.line_items];
    updatedItems[index] = { ...updatedItems[index]!, [field]: value };
    setFormData({ ...formData, line_items: updatedItems });
  };

  const removeLineItem = (index: number): void => {
    setFormData({
      ...formData,
      line_items: formData.line_items.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
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
      setError(getFulfilErrorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} PO`));
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
      <h1 className="mb-6 text-3xl font-bold">
        {isEdit ? 'Edit Purchase Order' : 'Create Purchase Order'}
      </h1>

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
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="mb-4">
              <label htmlFor="start_date" className="mb-1 block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                value={formData.start_date}
                onChange={handleChange}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              <label
                htmlFor="expiration_date"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Expiration Date
              </label>
              <input
                id="expiration_date"
                name="expiration_date"
                type="date"
                value={formData.expiration_date}
                onChange={handleChange}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor="google_doc_url"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Google Doc URL
            </label>
            <input
              id="google_doc_url"
              name="google_doc_url"
              value={formData.google_doc_url}
              onChange={handleChange}
              placeholder="https://docs.google.com/..."
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="hubspot_url" className="mb-1 block text-sm font-medium text-gray-700">
              HubSpot URL
            </label>
            <input
              id="hubspot_url"
              name="hubspot_url"
              value={formData.hubspot_url}
              onChange={handleChange}
              placeholder="https://app.hubspot.com/..."
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
                      className="w-full rounded border border-gray-300 px-3 py-2"
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
                    <label className="mb-1 block text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number"
                      value={lineItem.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value))}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Price per Unit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={lineItem.price_per_unit}
                      onChange={(e) => updateLineItem(index, 'price_per_unit', e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                      required
                    />
                  </div>
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
              {isEdit ? 'Update' : 'Create'} PO
            </button>
            <button
              type="button"
              className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
              onClick={() => navigate('/pos')}
            >
              Cancel
            </button>
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
}
