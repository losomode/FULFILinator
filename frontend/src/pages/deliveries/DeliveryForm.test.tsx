import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DeliveryForm from './DeliveryForm';

const mockNavigate = vi.fn();
let mockParams: Record<string, string> = {};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => mockParams };
});

vi.mock('../../api/deliveries', () => ({ deliveriesApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }));
vi.mock('../../api/items', () => ({ itemsApi: { list: vi.fn() } }));
vi.mock('../../api/orders', () => ({ ordersApi: { list: vi.fn() } }));

import { deliveriesApi } from '../../api/deliveries';
import { itemsApi } from '../../api/items';
import { ordersApi } from '../../api/orders';

describe('DeliveryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {};
    vi.mocked(itemsApi.list).mockResolvedValue([
      { id: 1, name: 'Camera', version: '1.0', msrp: '999', min_price: '799' } as any,
    ]);
    vi.mocked(ordersApi.list).mockResolvedValue([]);
  });

  it('renders create mode', async () => {
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());
    expect(screen.getByText('Line Items (with Serial Numbers)')).toBeInTheDocument();
  });

  it('renders edit mode', async () => {
    mockParams = { id: '1' };
    vi.mocked(deliveriesApi.get).mockResolvedValue({
      id: 1, customer_id: 'C1', ship_date: '2026-01-15', tracking_number: 'T1',
      status: 'OPEN', line_items: [{ item: 1, serial_number: 'SN1', price_per_unit: '9' }],
    } as any);

    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Edit Delivery')).toBeInTheDocument());
  });

  it('shows load error', async () => {
    mockParams = { id: '1' };
    vi.mocked(deliveriesApi.get).mockRejectedValue(new Error('load fail'));
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('load fail')).toBeInTheDocument());
  });

  it('shows items load error', async () => {
    vi.mocked(itemsApi.list).mockRejectedValue(new Error('items fail'));
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Failed to load items')).toBeInTheDocument());
  });

  it('adds and removes line items', async () => {
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    expect(screen.getByText(/No line items/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add Item'));
    expect(screen.queryByText(/No line items/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Remove'));
    expect(screen.getByText(/No line items/)).toBeInTheDocument();
  });

  it('validates line items required', async () => {
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    fireEvent.submit(screen.getByText('Create Delivery', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('At least one line item is required')).toBeInTheDocument());
  });

  it('validates duplicate serial numbers', async () => {
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    // Add two line items with same serial
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Add Item'));

    const serialInputs = screen.getAllByPlaceholderText('SN123456');
    fireEvent.change(serialInputs[0], { target: { value: 'SN-DUP' } });
    fireEvent.change(serialInputs[1], { target: { value: 'SN-DUP' } });

    fireEvent.submit(screen.getByText('Create Delivery', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(screen.getByText(/Duplicate serial numbers/)).toBeInTheDocument());
  });

  it('submits create form', async () => {
    vi.mocked(deliveriesApi.create).mockResolvedValue({ id: 1 } as any);
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));
    const serialInput = screen.getByPlaceholderText('SN123456');
    fireEvent.change(serialInput, { target: { value: 'SN-001' } });

    fireEvent.submit(screen.getByText('Create Delivery', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(deliveriesApi.create).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/deliveries');
  });

  it('submits edit form', async () => {
    mockParams = { id: '1' };
    vi.mocked(deliveriesApi.get).mockResolvedValue({
      id: 1, customer_id: 'C1', ship_date: '2026-01-15', status: 'OPEN',
      line_items: [{ item: 1, serial_number: 'SN1', price_per_unit: '9' }],
    } as any);
    vi.mocked(deliveriesApi.update).mockResolvedValue({ id: 1 } as any);

    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Edit Delivery')).toBeInTheDocument());
    fireEvent.submit(screen.getByText('Update Delivery', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(deliveriesApi.update).toHaveBeenCalledWith(1, expect.any(Object)));
    expect(mockNavigate).toHaveBeenCalledWith('/deliveries');
  });

  it('shows submit error', async () => {
    vi.mocked(deliveriesApi.create).mockRejectedValue(new Error('submit fail'));
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));
    const serialInput = screen.getByPlaceholderText('SN123456');
    fireEvent.change(serialInput, { target: { value: 'SN-001' } });

    fireEvent.submit(screen.getByText('Create Delivery', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('submit fail')).toBeInTheDocument());
  });

  it('highlights fields with API validation errors', async () => {
    vi.mocked(deliveriesApi.create).mockRejectedValue({
      response: { data: { tracking_number: ['This field may not be blank.'] } },
    });
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.change(screen.getByPlaceholderText('SN123456'), { target: { value: 'SN-001' } });
    fireEvent.submit(screen.getByText('Create Delivery', { selector: 'button' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/tracking number: This field may not be blank/)).toBeInTheDocument();
    });
    // Tracking number input should have red border
    expect(screen.getByPlaceholderText('e.g., TRACK123456')).toHaveClass('border-red-500');
  });

  it('navigates on cancel', async () => {
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/deliveries');
  });

  it('loads orders for customer and links order line item', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue([
      {
        id: 1, order_number: 'ORD-001', customer_id: 'cust-123', status: 'OPEN',
        line_items: [{ id: 10, item: 1, item_name: 'Camera 1.0', quantity: 5, price_per_unit: '999' }],
      } as any,
    ]);

    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));

    // First combobox is the order line item selector
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '10' } });

    // Price should be auto-filled from order
    await waitFor(() => {
      expect(screen.getByDisplayValue('999')).toBeInTheDocument();
    });
  });

  it('handles form field changes', async () => {
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    const trackingInput = screen.getByPlaceholderText('e.g., TRACK123456');
    fireEvent.change(trackingInput, { target: { value: 'TRACK-NEW', name: 'tracking_number' } });
    expect(screen.getByDisplayValue('TRACK-NEW')).toBeInTheDocument();
  });

  it('updates line item fields', async () => {
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));
    const serialInput = screen.getByPlaceholderText('SN123456');
    fireEvent.change(serialInput, { target: { value: 'SN-TEST' } });
    expect(screen.getByDisplayValue('SN-TEST')).toBeInTheDocument();
  });
});
