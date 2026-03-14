import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { itemsApi } from '../../api';
import { getFulfilErrorMessage } from '../../types';
import type { Item } from '../../types';
import { useAuth } from '@inator/shared/auth/AuthProvider';

/** Displays a table of all catalog items. Admin users can create, edit, and delete. */
export function ItemList(): React.JSX.Element {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAdmin } = useAuth();

  useEffect(() => {
    void loadItems();
  }, []);

  const loadItems = async (): Promise<void> => {
    try {
      setLoading(true);
      const data = await itemsApi.list();
      setItems(data);
      setError('');
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to load items'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      await itemsApi.delete(id);
      await loadItems();
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to delete item'));
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Items</h1>
        {isAdmin && (
          <Link to="/items/new">
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              Create Item
            </button>
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Version
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                MSRP
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Min Price
              </th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {items.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-6 py-4 text-center text-gray-500">
                  No items found{isAdmin && '. Create your first item to get started'}.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="whitespace-nowrap px-6 py-4">{item.name}</td>
                  <td className="whitespace-nowrap px-6 py-4">{item.version}</td>
                  <td className="whitespace-nowrap px-6 py-4">${item.msrp}</td>
                  <td className="whitespace-nowrap px-6 py-4">${item.min_price}</td>
                  <td className="whitespace-nowrap px-6 py-4 space-x-2">
                    {isAdmin && (
                      <>
                        <Link to={`/items/${String(item.id)}/edit`}>
                          <button
                            type="button"
                            className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300"
                          >
                            Edit
                          </button>
                        </Link>
                        <button
                          type="button"
                          className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                          onClick={() => void handleDelete(item.id)}
                        >
                          Delete
                        </button>
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
}
