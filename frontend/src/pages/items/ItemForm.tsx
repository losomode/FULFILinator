import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { itemsApi } from '../../api';
import { getFulfilErrorMessage } from '../../types';
import type { Item } from '../../types';
import { useAuth } from '@inator/shared/auth/AuthProvider';

/** Form for creating or editing a catalog item. */
export function ItemForm(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    version: '',
    description: '',
    msrp: '',
    min_price: '',
    created_by_user_id: user?.username ?? '',
  });

  useEffect(() => {
    if (isEdit && id) {
      void loadItem(parseInt(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const loadItem = async (itemId: number): Promise<void> => {
    try {
      setLoading(true);
      const data = await itemsApi.get(itemId);
      setFormData({
        name: data.name,
        version: data.version,
        description: data.description ?? '',
        msrp: data.msrp,
        min_price: data.min_price,
        created_by_user_id: data.created_by_user_id ?? user?.username ?? '',
      });
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to load item'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');

    try {
      if (isEdit && id) {
        await itemsApi.update(parseInt(id), formData);
      } else {
        await itemsApi.create(formData as Omit<Item, 'id'>);
      }
      navigate('/items');
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} item`));
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
      <h1 className="mb-6 text-3xl font-bold">{isEdit ? 'Edit Item' : 'Create Item'}</h1>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="max-w-2xl rounded-lg bg-white p-6 shadow">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="mb-4">
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Camera LR, Node 4.6"
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="version" className="mb-1 block text-sm font-medium text-gray-700">
              Version <span className="text-red-500">*</span>
            </label>
            <input
              id="version"
              name="version"
              type="text"
              value={formData.version}
              onChange={handleChange}
              required
              placeholder="e.g., v2.0, GA"
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Optional description"
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="msrp" className="mb-1 block text-sm font-medium text-gray-700">
              MSRP <span className="text-red-500">*</span>
            </label>
            <input
              id="msrp"
              name="msrp"
              type="number"
              value={formData.msrp}
              onChange={handleChange}
              required
              placeholder="999.99"
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="min_price" className="mb-1 block text-sm font-medium text-gray-700">
              Minimum Price <span className="text-red-500">*</span>
            </label>
            <input
              id="min_price"
              name="min_price"
              type="number"
              value={formData.min_price}
              onChange={handleChange}
              required
              placeholder="750.00"
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex space-x-4">
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              {isEdit ? 'Update' : 'Create'} Item
            </button>
            <button
              type="button"
              className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
              onClick={() => navigate('/items')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
