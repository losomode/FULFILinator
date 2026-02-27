import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import OrderForm from './OrderForm';

const mockNavigate = vi.fn();
let mockParams: Record<string, string> = {};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => mockParams };
});

vi.mock('../../api/orders', () => ({ ordersApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }));
vi.mock('../../api/items', () => ({ itemsApi: { list: vi.fn() } }));
vi.mock('../../api/pos', () => ({ posApi: { list: vi.fn() } }));

import { ordersApi } from '../../api/orders';
import { itemsApi } from '../../api/items';
import { posApi } from '../../api/pos';

describe('OrderForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {};
    vi.mocked(itemsApi.list).mockResolvedValue([
      { id: 1, name: 'Camera', version: '1.0', msrp: '999', min_price: '799' } as any,
    ]);
    vi.mocked(posApi.list).mockResolvedValue([]);
  });

  it('renders create mode with allocation info', async () => {
    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument());
    expect(screen.getByText(/Automatic PO Allocation/)).toBeInTheDocument();
  });

  it('renders edit mode', async () => {
    mockParams = { id: '1' };
    vi.mocked(ordersApi.get).mockResolvedValue({
      id: 1, customer_id: 'C1', status: 'OPEN', notes: 'test',
      line_items: [{ item: 1, quantity: 5 }],
    } as any);

    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Edit Order')).toBeInTheDocument());
  });

  it('shows load error', async () => {
    mockParams = { id: '1' };
    vi.mocked(ordersApi.get).mockRejectedValue(new Error('load fail'));
    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('load fail')).toBeInTheDocument());
  });

  it('toggles allocation preview', async () => {
    vi.mocked(posApi.list).mockResolvedValue([
      { id: 1, po_number: 'PO-1', customer_id: 'cust-123', status: 'OPEN', fulfillment_status: { line_items: [] } } as any,
    ]);
    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Show Preview'));
    await waitFor(() => expect(screen.getByText('Available POs for Allocation')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Hide Preview'));
    expect(screen.queryByText('Available POs for Allocation')).not.toBeInTheDocument();
  });

  it('adds and removes line items', async () => {
    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument());

    expect(screen.getByText(/No line items/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add Item'));
    expect(screen.queryByText(/No line items/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Remove'));
    expect(screen.getByText(/No line items/)).toBeInTheDocument();
  });

  it('validates line items required', async () => {
    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument());

    fireEvent.submit(screen.getByText('Create Order', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('At least one line item is required')).toBeInTheDocument());
  });

  it('submits create form', async () => {
    vi.mocked(ordersApi.create).mockResolvedValue({ id: 1 } as any);
    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.submit(screen.getByText('Create Order', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(ordersApi.create).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/orders');
  });

  it('submits edit form', async () => {
    mockParams = { id: '1' };
    vi.mocked(ordersApi.get).mockResolvedValue({
      id: 1, customer_id: 'C1', status: 'OPEN',
      line_items: [{ item: 1, quantity: 5 }],
    } as any);
    vi.mocked(ordersApi.update).mockResolvedValue({ id: 1 } as any);

    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Edit Order')).toBeInTheDocument());
    fireEvent.submit(screen.getByText('Update Order', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(ordersApi.update).toHaveBeenCalledWith(1, expect.any(Object)));
    expect(mockNavigate).toHaveBeenCalledWith('/orders');
  });

  it('shows submit error', async () => {
    vi.mocked(ordersApi.create).mockRejectedValue(new Error('submit fail'));
    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.submit(screen.getByText('Create Order', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('submit fail')).toBeInTheDocument());
  });

  it('highlights fields with API validation errors', async () => {
    vi.mocked(ordersApi.create).mockRejectedValue({
      response: { data: { customer_id: ['This field may not be blank.'] } },
    });
    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.submit(screen.getByText('Create Order', { selector: 'button' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/customer id: This field may not be blank/)).toBeInTheDocument();
    });
  });

  it('navigates on cancel', async () => {
    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/orders');
  });

  it('handles form field changes', async () => {
    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument());

    const customerInput = screen.getByDisplayValue('cust-123');
    fireEvent.change(customerInput, { target: { value: 'cust-456', name: 'customer_id' } });
    expect(screen.getByDisplayValue('cust-456')).toBeInTheDocument();
  });

  it('updates line item fields', async () => {
    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));
    const qtyInput = screen.getByDisplayValue('1');
    fireEvent.change(qtyInput, { target: { value: '10' } });
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
  });

  it('shows PO price when allocating from PO', async () => {
    vi.mocked(posApi.list).mockResolvedValue([
      {
        id: 1, po_number: 'PO-1', customer_id: 'cust-123', status: 'OPEN',
        fulfillment_status: {
          line_items: [
            { item_id: 1, item_name: 'Camera', remaining_quantity: 5, price_per_unit: '899.99', original_quantity: 10, ordered_quantity: 5 },
          ],
          orders: [],
        },
      } as any,
    ]);

    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));

    // Select the Camera item
    const itemSelect = screen.getByRole('combobox');
    fireEvent.change(itemSelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getByText('$899.99 / unit')).toBeInTheDocument();
    });
  });

  it('shows ad-hoc price field when not allocating from PO', async () => {
    render(<BrowserRouter><OrderForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument());

    // Uncheck allocation
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText(/Ad-hoc order/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add Item'));
    expect(screen.getByText('Price per Unit')).toBeInTheDocument();
  });
});
