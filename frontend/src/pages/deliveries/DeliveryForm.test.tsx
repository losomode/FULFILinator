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

const mockOrders = [
  {
    id: 1, order_number: 'ORD-001', customer_id: 'cust-123', status: 'OPEN',
    line_items: [{ id: 10, item: 1, item_name: 'Camera 1.0', quantity: 5, price_per_unit: '999' }],
  },
  {
    id: 2, order_number: 'ORD-002', customer_id: 'cust-123', status: 'OPEN',
    line_items: [{ id: 20, item: 1, item_name: 'Camera 1.0', quantity: 3, price_per_unit: '899' }],
  },
];

/** Helper: add an order group, select an order, and optionally add an item. */
const addOrderWithItem = async (orderValue = '1') => {
  fireEvent.click(screen.getByText('Add Order'));
  fireEvent.change(screen.getByTestId('order-select-0'), { target: { value: orderValue } });
  await waitFor(() => expect(screen.getByText('Add Item')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Add Item'));
};

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
    expect(screen.getByText('Orders & Items')).toBeInTheDocument();
  });

  it('renders edit mode', async () => {
    mockParams = { id: '1' };
    vi.mocked(deliveriesApi.get).mockResolvedValue({
      id: 1, customer_id: 'C1', ship_date: '2026-01-15', tracking_number: 'T1',
      status: 'OPEN', line_items: [{ item: 1, serial_number: 'SN1', price_per_unit: '9', order_number: 'ORD-001' }],
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

  it('adds and removes order groups', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue(mockOrders as any);
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    expect(screen.getByText(/No orders added/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add Order'));
    expect(screen.queryByText(/No orders added/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Remove Order'));
    expect(screen.getByText(/No orders added/)).toBeInTheDocument();
  });

  it('adds and removes items within an order group', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue(mockOrders as any);
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Order'));
    fireEvent.change(screen.getByTestId('order-select-0'), { target: { value: '1' } });

    await waitFor(() => expect(screen.getByText('Add Item')).toBeInTheDocument());
    expect(screen.getByText(/No items yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add Item'));
    expect(screen.queryByText(/No items yet/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Remove'));
    expect(screen.getByText(/No items yet/)).toBeInTheDocument();
  });

  it('validates line items required', async () => {
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    fireEvent.submit(screen.getByText('Create Delivery', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('At least one line item is required')).toBeInTheDocument());
  });

  it('validates duplicate serial numbers', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue(mockOrders as any);
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Order'));
    fireEvent.change(screen.getByTestId('order-select-0'), { target: { value: '1' } });
    await waitFor(() => expect(screen.getByText('Add Item')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Add Item'));

    const serialInputs = screen.getAllByPlaceholderText('SN123456');
    fireEvent.change(serialInputs[0], { target: { value: 'SN-DUP' } });
    fireEvent.change(serialInputs[1], { target: { value: 'SN-DUP' } });

    fireEvent.submit(screen.getByText('Create Delivery', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(screen.getByText(/Duplicate serial numbers/)).toBeInTheDocument());
  });

  it('submits create form', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue(mockOrders as any);
    vi.mocked(deliveriesApi.create).mockResolvedValue({ id: 1 } as any);
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    await addOrderWithItem();
    fireEvent.change(screen.getByPlaceholderText('SN123456'), { target: { value: 'SN-001' } });

    fireEvent.submit(screen.getByText('Create Delivery', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(deliveriesApi.create).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/deliveries');
  });

  it('submits edit form', async () => {
    mockParams = { id: '1' };
    vi.mocked(ordersApi.list).mockResolvedValue(mockOrders as any);
    vi.mocked(deliveriesApi.get).mockResolvedValue({
      id: 1, customer_id: 'cust-123', ship_date: '2026-01-15', status: 'OPEN',
      line_items: [{ item: 1, serial_number: 'SN1', price_per_unit: '999', order_line_item: 10, order_number: 'ORD-001' }],
    } as any);
    vi.mocked(deliveriesApi.update).mockResolvedValue({ id: 1 } as any);

    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Edit Delivery')).toBeInTheDocument());
    fireEvent.submit(screen.getByText('Update Delivery', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(deliveriesApi.update).toHaveBeenCalledWith(1, expect.any(Object)));
    expect(mockNavigate).toHaveBeenCalledWith('/deliveries');
  });

  it('shows submit error', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue(mockOrders as any);
    vi.mocked(deliveriesApi.create).mockRejectedValue(new Error('submit fail'));
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    await addOrderWithItem();
    fireEvent.change(screen.getByPlaceholderText('SN123456'), { target: { value: 'SN-001' } });

    fireEvent.submit(screen.getByText('Create Delivery', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('submit fail')).toBeInTheDocument());
  });

  it('highlights fields with API validation errors', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue(mockOrders as any);
    vi.mocked(deliveriesApi.create).mockRejectedValue({
      response: { data: { tracking_number: ['This field may not be blank.'] } },
    });
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    await addOrderWithItem();
    fireEvent.change(screen.getByPlaceholderText('SN123456'), { target: { value: 'SN-001' } });
    fireEvent.submit(screen.getByText('Create Delivery', { selector: 'button' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/tracking number: This field may not be blank/)).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('e.g., TRACK123456')).toHaveClass('border-red-500');
  });

  it('navigates on cancel', async () => {
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/deliveries');
  });

  it('selects order and links item type with auto-filled price', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue(mockOrders as any);
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    await addOrderWithItem();

    // Select item type from the order's line items
    fireEvent.change(screen.getByTestId('item-type-0-0'), { target: { value: '10' } });

    // Price should be auto-filled from the order line item
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

  it('updates line item serial number', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue(mockOrders as any);
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    await addOrderWithItem();
    const serialInput = screen.getByPlaceholderText('SN123456');
    fireEvent.change(serialInput, { target: { value: 'SN-TEST' } });
    expect(screen.getByDisplayValue('SN-TEST')).toBeInTheDocument();
  });

  it('shows prompt to select order before adding items', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue(mockOrders as any);
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Order'));
    expect(screen.getByText(/Select an order above/)).toBeInTheDocument();
  });

  it('disables Add Order button when no open orders', async () => {
    render(<BrowserRouter><DeliveryForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Delivery' })).toBeInTheDocument());

    expect(screen.getByText('Add Order')).toBeDisabled();
    expect(screen.getByText(/No open orders found/)).toBeInTheDocument();
  });
});
