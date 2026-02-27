import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DeliveryDetail from './DeliveryDetail';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '1' }) };
});

vi.mock('../../api/deliveries', () => ({ deliveriesApi: { get: vi.fn(), close: vi.fn() } }));
vi.mock('../../api/items', () => ({ itemsApi: { list: vi.fn() } }));
vi.mock('../../components/AttachmentList', () => ({ default: () => <div>Attachments</div> }));

import { deliveriesApi } from '../../api/deliveries';
import { itemsApi } from '../../api/items';

const mockDelivery = {
  id: 1, delivery_number: 'DEL-001', customer_id: 'C1', customer_name: 'Acme',
  ship_date: '2026-01-15', tracking_number: 'TRACK123', status: 'OPEN' as const,
  notes: 'test note',
  line_items: [
    { item: 1, serial_number: 'SN-001', price_per_unit: '100', order_line_item: 5 },
  ],
  created_at: '2026-01-01T00:00:00Z',
};

describe('DeliveryDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(itemsApi.list).mockResolvedValue([
      { id: 1, name: 'Camera', version: '1.0' } as any,
    ]);
  });

  it('renders delivery detail', async () => {
    vi.mocked(deliveriesApi.get).mockResolvedValue(mockDelivery as any);
    render(<BrowserRouter><DeliveryDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('DEL-001')).toBeInTheDocument());
    expect(screen.getByText('TRACK123')).toBeInTheDocument();
    expect(screen.getByText('test note')).toBeInTheDocument();
    expect(screen.getByText('SN-001')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByText(/Order Line #5/)).toBeInTheDocument();
  });

  it('shows error', async () => {
    vi.mocked(deliveriesApi.get).mockRejectedValue(new Error('load fail'));
    render(<BrowserRouter><DeliveryDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('load fail')).toBeInTheDocument());
  });

  it('shows not found', async () => {
    vi.mocked(deliveriesApi.get).mockResolvedValue(null as any);
    render(<BrowserRouter><DeliveryDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Delivery not found')).toBeInTheDocument());
  });

  it('handles close delivery', async () => {
    vi.mocked(deliveriesApi.get).mockResolvedValue(mockDelivery as any);
    vi.mocked(deliveriesApi.close).mockResolvedValue({ ...mockDelivery, status: 'CLOSED' } as any);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<BrowserRouter><DeliveryDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Close Delivery')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Close Delivery'));
    await waitFor(() => expect(deliveriesApi.close).toHaveBeenCalledWith(1));
  });

  it('cancels close', async () => {
    vi.mocked(deliveriesApi.get).mockResolvedValue(mockDelivery as any);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<BrowserRouter><DeliveryDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Close Delivery')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Close Delivery'));
    expect(deliveriesApi.close).not.toHaveBeenCalled();
  });

  it('shows close error', async () => {
    vi.mocked(deliveriesApi.get).mockResolvedValue(mockDelivery as any);
    vi.mocked(deliveriesApi.close).mockRejectedValue(new Error('close fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<BrowserRouter><DeliveryDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Close Delivery')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Close Delivery'));
    await waitFor(() => expect(screen.getByText('close fail')).toBeInTheDocument());
  });

  it('hides close button for closed delivery', async () => {
    vi.mocked(deliveriesApi.get).mockResolvedValue({
      ...mockDelivery, status: 'CLOSED', closed_at: '2026-02-01T00:00:00Z',
    } as any);
    render(<BrowserRouter><DeliveryDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('CLOSED')).toBeInTheDocument());
    expect(screen.queryByText('Close Delivery')).not.toBeInTheDocument();
  });

  it('shows customer_id with name', async () => {
    vi.mocked(deliveriesApi.get).mockResolvedValue(mockDelivery as any);
    render(<BrowserRouter><DeliveryDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument());
    expect(screen.getByText('(C1)')).toBeInTheDocument();
  });

  it('shows N/A for missing optional fields', async () => {
    vi.mocked(deliveriesApi.get).mockResolvedValue({
      ...mockDelivery,
      tracking_number: undefined, notes: undefined,
      line_items: [{ item: 1, serial_number: 'SN', price_per_unit: undefined, order_line_item: undefined }],
    } as any);
    render(<BrowserRouter><DeliveryDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('DEL-001')).toBeInTheDocument());
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
  });
});
