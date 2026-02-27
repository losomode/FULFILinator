import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import OrderDetail from './OrderDetail';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '1' }) };
});

vi.mock('../../api/orders', () => ({ ordersApi: { get: vi.fn(), close: vi.fn() } }));
vi.mock('../../api/items', () => ({ itemsApi: { list: vi.fn() } }));
vi.mock('../../components/AttachmentList', () => ({ default: () => <div>Attachments</div> }));

import { ordersApi } from '../../api/orders';
import { itemsApi } from '../../api/items';

const mockOrder = {
  id: 1, order_number: 'ORD-001', customer_id: 'C1', customer_name: 'Acme',
  status: 'OPEN' as const, notes: 'test note',
  line_items: [{ item: 1, quantity: 5, price_per_unit: '100', po_line_item: 10 }],
  fulfillment_status: {
    line_items: [{
      item_name: 'Camera', original_quantity: 5, delivered_quantity: 3,
      remaining_quantity: 2, price_per_unit: '100',
    }],
    source_pos: [{ po_id: 1, po_number: 'PO-001' }],
    deliveries: [{ delivery_id: 1, delivery_number: 'DEL-001' }],
  },
  created_at: '2026-01-01T00:00:00Z',
};

describe('OrderDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(itemsApi.list).mockResolvedValue([
      { id: 1, name: 'Camera', version: '1.0' } as any,
    ]);
  });

  it('renders order detail', async () => {
    vi.mocked(ordersApi.get).mockResolvedValue(mockOrder as any);
    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('test note')).toBeInTheDocument();
  });

  it('shows error on load failure', async () => {
    vi.mocked(ordersApi.get).mockRejectedValue(new Error('load fail'));
    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('load fail')).toBeInTheDocument());
  });

  it('shows not found when no order', async () => {
    vi.mocked(ordersApi.get).mockResolvedValue(null as any);
    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Order not found')).toBeInTheDocument());
  });

  it('displays fulfillment status', async () => {
    vi.mocked(ordersApi.get).mockResolvedValue(mockOrder as any);
    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Fulfillment Status')).toBeInTheDocument());
    expect(screen.getByText('60% Delivered')).toBeInTheDocument();
    expect(screen.getByText('PO-001')).toBeInTheDocument();
    expect(screen.getByText('DEL-001')).toBeInTheDocument();
  });

  it('shows Fully Delivered when complete', async () => {
    const fullyDelivered = {
      ...mockOrder,
      fulfillment_status: {
        ...mockOrder.fulfillment_status,
        line_items: [{
          item_name: 'Camera', original_quantity: 5, delivered_quantity: 5,
          remaining_quantity: 0, price_per_unit: '100',
        }],
      },
    };
    vi.mocked(ordersApi.get).mockResolvedValue(fullyDelivered as any);
    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Fully Delivered')).toBeInTheDocument());
  });

  it('shows Not Started when nothing delivered', async () => {
    const notStarted = {
      ...mockOrder,
      fulfillment_status: {
        ...mockOrder.fulfillment_status,
        line_items: [{
          item_name: 'Camera', original_quantity: 5, delivered_quantity: 0,
          remaining_quantity: 5, price_per_unit: '100',
        }],
      },
    };
    vi.mocked(ordersApi.get).mockResolvedValue(notStarted as any);
    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Not Started')).toBeInTheDocument());
  });

  it('shows no fulfillment message when empty', async () => {
    const noFulfillment = { ...mockOrder, fulfillment_status: { line_items: [], source_pos: [], deliveries: [] } };
    vi.mocked(ordersApi.get).mockResolvedValue(noFulfillment as any);
    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText(/No deliveries have been created/)).toBeInTheDocument());
  });

  it('handles close order', async () => {
    vi.mocked(ordersApi.get).mockResolvedValue(mockOrder as any);
    vi.mocked(ordersApi.close).mockResolvedValue({ ...mockOrder, status: 'CLOSED' } as any);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Close Order')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Close Order'));
    await waitFor(() => expect(ordersApi.close).toHaveBeenCalledWith(1));
  });

  it('cancels close order', async () => {
    vi.mocked(ordersApi.get).mockResolvedValue(mockOrder as any);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Close Order')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Close Order'));
    expect(ordersApi.close).not.toHaveBeenCalled();
  });

  it('shows close error', async () => {
    vi.mocked(ordersApi.get).mockResolvedValue(mockOrder as any);
    vi.mocked(ordersApi.close).mockRejectedValue(new Error('close fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Close Order')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Close Order'));
    await waitFor(() => expect(screen.getByText('close fail')).toBeInTheDocument());
  });

  it('hides close button for closed order', async () => {
    vi.mocked(ordersApi.get).mockResolvedValue({ ...mockOrder, status: 'CLOSED', closed_at: '2026-02-01T00:00:00Z' } as any);
    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('CLOSED')).toBeInTheDocument());
    expect(screen.queryByText('Close Order')).not.toBeInTheDocument();
  });

  it('shows line item details', async () => {
    vi.mocked(ordersApi.get).mockResolvedValue(mockOrder as any);
    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('$100')).toBeInTheDocument());
    expect(screen.getByText(/PO Line #10/)).toBeInTheDocument();
  });

  it('shows Ad-hoc when no po_line_item', async () => {
    const adhocOrder = {
      ...mockOrder,
      line_items: [{ item: 1, quantity: 5, price_per_unit: undefined, po_line_item: undefined }],
    };
    vi.mocked(ordersApi.get).mockResolvedValue(adhocOrder as any);
    render(<BrowserRouter><OrderDetail /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Ad-hoc')).toBeInTheDocument());
    expect(screen.getByText('Allocated')).toBeInTheDocument();
  });
});
