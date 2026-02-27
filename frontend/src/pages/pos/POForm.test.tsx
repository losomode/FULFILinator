import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import POForm from './POForm';

const mockNavigate = vi.fn();
let mockParams: Record<string, string> = {};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => mockParams };
});

vi.mock('../../api/pos', () => ({ posApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }));
vi.mock('../../api/items', () => ({ itemsApi: { list: vi.fn() } }));

import { posApi } from '../../api/pos';
import { itemsApi } from '../../api/items';

describe('POForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {};
    vi.mocked(itemsApi.list).mockResolvedValue([
      { id: 1, name: 'Camera', version: '1.0', msrp: '999', min_price: '799' } as any,
    ]);
  });

  it('renders create mode', async () => {
    render(<BrowserRouter><POForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Create Purchase Order')).toBeInTheDocument());
  });

  it('renders edit mode', async () => {
    mockParams = { id: '1' };
    vi.mocked(posApi.get).mockResolvedValue({
      id: 1, customer_id: 'C1', start_date: '2026-01-01', status: 'OPEN',
      line_items: [{ id: 1, item: 1, quantity: 5, price_per_unit: '9' }],
    } as any);

    render(<BrowserRouter><POForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Edit Purchase Order')).toBeInTheDocument());
  });

  it('shows load error in edit mode', async () => {
    mockParams = { id: '1' };
    vi.mocked(posApi.get).mockRejectedValue(new Error('load fail'));
    render(<BrowserRouter><POForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('load fail')).toBeInTheDocument());
  });

  it('shows items load error', async () => {
    vi.mocked(itemsApi.list).mockRejectedValue(new Error('items fail'));
    render(<BrowserRouter><POForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Failed to load items')).toBeInTheDocument());
  });

  it('adds and removes line items', async () => {
    render(<BrowserRouter><POForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Create Purchase Order')).toBeInTheDocument());

    // Initially no line items
    expect(screen.getByText(/No line items/)).toBeInTheDocument();

    // Add item
    fireEvent.click(screen.getByText('Add Item'));
    expect(screen.queryByText(/No line items/)).not.toBeInTheDocument();

    // Remove item
    fireEvent.click(screen.getByText('Remove'));
    expect(screen.getByText(/No line items/)).toBeInTheDocument();
  });

  it('validates at least one line item', async () => {
    render(<BrowserRouter><POForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Create Purchase Order')).toBeInTheDocument());

    fireEvent.submit(screen.getByText('Create PO', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('At least one line item is required')).toBeInTheDocument());
  });

  it('submits create form', async () => {
    vi.mocked(posApi.create).mockResolvedValue({ id: 1 } as any);
    render(<BrowserRouter><POForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Create Purchase Order')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.submit(screen.getByText('Create PO', { selector: 'button' }).closest('form')!);

    await waitFor(() => expect(posApi.create).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/pos');
  });

  it('submits edit form', async () => {
    mockParams = { id: '1' };
    vi.mocked(posApi.get).mockResolvedValue({
      id: 1, customer_id: 'C1', status: 'OPEN',
      line_items: [{ id: 1, item: 1, quantity: 5, price_per_unit: '9' }],
    } as any);
    vi.mocked(posApi.update).mockResolvedValue({ id: 1 } as any);

    render(<BrowserRouter><POForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Edit Purchase Order')).toBeInTheDocument());
    fireEvent.submit(screen.getByText('Update PO', { selector: 'button' }).closest('form')!);

    await waitFor(() => expect(posApi.update).toHaveBeenCalledWith(1, expect.any(Object)));
    expect(mockNavigate).toHaveBeenCalledWith('/pos');
  });

  it('shows submit error', async () => {
    vi.mocked(posApi.create).mockRejectedValue(new Error('submit fail'));
    render(<BrowserRouter><POForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Create Purchase Order')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.submit(screen.getByText('Create PO', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('submit fail')).toBeInTheDocument());
  });

  it('navigates on cancel', async () => {
    render(<BrowserRouter><POForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Create Purchase Order')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/pos');
  });

  it('updates line item fields', async () => {
    render(<BrowserRouter><POForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Create Purchase Order')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add Item'));

    // Update quantity
    const quantityInput = screen.getByDisplayValue('1');
    fireEvent.change(quantityInput, { target: { value: '10' } });
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
  });
});
