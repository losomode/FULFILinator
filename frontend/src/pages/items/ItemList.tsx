import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { itemsApi } from '../../api/items';
import { getApiErrorMessage, Item } from '../../api/types';
import Button from '../../components/Button';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import { useUser } from '../../hooks/useUser';

const ItemList: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAdmin } = useUser();

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await itemsApi.list();
      setItems(data);
      setError('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load items'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      await itemsApi.delete(id);
      loadItems();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to delete item'));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Items</h1>
        {isAdmin && (
          <Link to="/items/new">
            <Button>Create Item</Button>
          </Link>
        )}
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MSRP</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Price</th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-6 py-4 text-center text-gray-500">
                  No items found{isAdmin && '. Create your first item to get started'}.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.version}</td>
                  <td className="px-6 py-4 whitespace-nowrap">${item.msrp}</td>
                  <td className="px-6 py-4 whitespace-nowrap">${item.min_price}</td>
                  <td className="px-6 py-4 whitespace-nowrap space-x-2">
                    {isAdmin && (
                      <>
                        <Link to={`/items/${item.id}/edit`}>
                          <Button variant="secondary" className="text-sm">Edit</Button>
                        </Link>
                        <Button
                          variant="danger"
                          className="text-sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ItemList;
