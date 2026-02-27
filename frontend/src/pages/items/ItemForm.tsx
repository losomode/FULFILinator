import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { itemsApi } from '../../api/items';
import { getApiErrorMessage, Item } from '../../api/types';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';

const ItemForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    version: '',
    description: '',
    msrp: '',
    min_price: '',
    created_by_user_id: 'user-001', // Mock user ID
  });

  useEffect(() => {
    if (isEdit && id) {
      loadItem(parseInt(id));
    }
  }, [id, isEdit]);

  const loadItem = async (itemId: number) => {
    try {
      setLoading(true);
      const data = await itemsApi.get(itemId);
      setFormData({
        name: data.name,
        version: data.version,
        description: data.description || '',
        msrp: data.msrp,
        min_price: data.min_price,
        created_by_user_id: data.created_by_user_id || 'user-001',
      });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load item'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      setError(getApiErrorMessage(err, `Failed to ${isEdit ? 'update' : 'create'} item`));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">{isEdit ? 'Edit Item' : 'Create Item'}</h1>

      {error && <ErrorMessage message={error} />}

      <div className="bg-white shadow rounded-lg p-6 max-w-2xl">
        <form onSubmit={handleSubmit}>
          <FormField
            label="Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="e.g., Camera LR, Node 4.6"
          />

          <FormField
            label="Version"
            name="version"
            value={formData.version}
            onChange={handleChange}
            required
            placeholder="e.g., v2.0, GA"
          />

          <FormField
            label="Description"
            name="description"
            type="textarea"
            value={formData.description}
            onChange={handleChange}
            placeholder="Optional description"
          />

          <FormField
            label="MSRP"
            name="msrp"
            type="number"
            value={formData.msrp}
            onChange={handleChange}
            required
            placeholder="999.99"
          />

          <FormField
            label="Minimum Price"
            name="min_price"
            type="number"
            value={formData.min_price}
            onChange={handleChange}
            required
            placeholder="750.00"
          />

          <div className="flex space-x-4">
            <Button type="submit">{isEdit ? 'Update' : 'Create'} Item</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/items')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemForm;
