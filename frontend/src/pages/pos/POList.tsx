import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { posApi } from '../../api/pos';
import { getApiErrorMessage, PurchaseOrder } from '../../api/types';
import Button from '../../components/Button';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import { useUser } from '../../hooks/useUser';

const POList: React.FC = () => {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAdmin } = useUser();

  useEffect(() => {
    loadPOs();
  }, []);

  const loadPOs = async () => {
    try {
      setLoading(true);
      const data = await posApi.list();
      setPos(data);
      setError('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load purchase orders'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this PO?')) return;

    try {
      await posApi.delete(id);
      loadPOs();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to delete PO'));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Purchase Orders</h1>
        {isAdmin && (
          <Link to="/pos/new">
            <Button>Create PO</Button>
          </Link>
        )}
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pos.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-6 py-4 text-center text-gray-500">
                  No purchase orders found{isAdmin && '. Create your first PO to get started'}.
                </td>
              </tr>
            ) : (
              pos.map((po) => (
                <tr key={po.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                    <Link to={`/pos/${po.id}`}>{po.po_number}</Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {po.customer_name || po.customer_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{po.start_date || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      po.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{po.line_items?.length || 0}</td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap space-x-2">
                      <Link to={`/pos/${po.id}/edit`}>
                        <Button variant="secondary" className="text-sm">Edit</Button>
                      </Link>
                      <Button
                        variant="danger"
                        className="text-sm"
                        onClick={() => handleDelete(po.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default POList;
