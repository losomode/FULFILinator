import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { deliveriesApi } from '../../api/deliveries';
import { getApiErrorMessage, isNotFoundError, Delivery } from '../../api/types';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import ErrorMessage from '../../components/ErrorMessage';

const SerialSearch: React.FC = () => {
  const [serialNumber, setSerialNumber] = useState('');
  const [result, setResult] = useState<Delivery | null>(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim()) {
      setError('Please enter a serial number');
      return;
    }

    try {
      setSearching(true);
      setError('');
      setResult(null);
      const data = await deliveriesApi.searchSerial(serialNumber.trim());
      setResult(data);
    } catch (err: unknown) {
      if (isNotFoundError(err)) {
        setError('Serial number not found');
      } else {
        setError(getApiErrorMessage(err, 'Failed to search for serial number'));
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="text-right">
          <Link to="/deliveries" className="text-blue-600 hover:underline mb-2 inline-block">
            ← Back to Deliveries
          </Link>
        </div>
        <h1 className="text-3xl font-bold mt-2">Search by Serial Number</h1>
      </div>

      <div className="bg-white shadow rounded-lg p-6 max-w-2xl mb-6">
        <form onSubmit={handleSearch}>
          <FormField
            label="Serial Number"
            name="serial_number"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="Enter serial number (e.g., SN123456)"
            required
          />

          <Button type="submit" disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </form>
      </div>

      {error && <ErrorMessage message={error} />}

      {result && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Search Result</h2>
          
          <div className="border-l-4 border-green-500 bg-green-50 p-4 mb-4">
            <p className="text-sm text-green-800">
              <strong>Serial number found!</strong> This item was delivered in:
            </p>
          </div>

          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Delivery Number</dt>
              <dd className="mt-1">
                <Link 
                  to={`/deliveries/${result.id}`} 
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
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                  result.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {result.status}
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <Link to={`/deliveries/${result.id}`}>
              <Button>View Full Delivery Details</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default SerialSearch;
