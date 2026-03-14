import { useState } from 'react';
import { Link } from 'react-router-dom';
import { deliveriesApi } from '../../api';
import { getFulfilErrorMessage, isNotFoundError } from '../../types';
import type { Delivery } from '../../types';

/** Search for a delivery by serial number. */
export function SerialSearch(): React.JSX.Element {
  const [serialNumber, setSerialNumber] = useState('');
  const [result, setResult] = useState<Delivery | null>(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!serialNumber.trim()) {
      setError('Please enter a serial number');
      return;
    }

    try {
      setSearching(true);
      setError('');
      setResult(null);
      setResult(await deliveriesApi.searchSerial(serialNumber.trim()));
    } catch (err: unknown) {
      if (isNotFoundError(err)) setError('Serial number not found');
      else setError(getFulfilErrorMessage(err, 'Failed to search for serial number'));
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="text-right">
          <Link to="/deliveries" className="mb-2 inline-block text-blue-600 hover:underline">
            ← Back to Deliveries
          </Link>
        </div>
        <h1 className="mt-2 text-3xl font-bold">Search by Serial Number</h1>
      </div>

      <div className="mb-6 max-w-2xl rounded-lg bg-white p-6 shadow">
        <form onSubmit={(e) => void handleSearch(e)}>
          <div className="mb-4">
            <label htmlFor="serial_number" className="mb-1 block text-sm font-medium text-gray-700">
              Serial Number <span className="text-red-500">*</span>
            </label>
            <input
              id="serial_number"
              name="serial_number"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Enter serial number (e.g., SN123456)"
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Search Result</h2>
          <div className="mb-4 border-l-4 border-green-500 bg-green-50 p-4">
            <p className="text-sm text-green-800">
              <strong>Serial number found!</strong> This item was delivered in:
            </p>
          </div>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Delivery Number</dt>
              <dd className="mt-1">
                <Link
                  to={`/deliveries/${String(result.id)}`}
                  className="text-lg font-medium text-blue-600 hover:underline"
                >
                  {result.delivery_number}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer</dt>
              <dd className="mt-1 text-sm text-gray-900">{result.customer_id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Ship Date</dt>
              <dd className="mt-1 text-sm text-gray-900">{result.ship_date}</dd>
            </div>
            {result.tracking_number && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Tracking Number</dt>
                <dd className="mt-1 text-sm text-gray-900">{result.tracking_number}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span
                  className={`inline-block rounded px-2 py-1 text-xs font-medium ${result.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                >
                  {result.status}
                </span>
              </dd>
            </div>
          </dl>
          <div className="mt-6">
            <Link to={`/deliveries/${String(result.id)}`}>
              <button
                type="button"
                className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                View Full Delivery Details
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
