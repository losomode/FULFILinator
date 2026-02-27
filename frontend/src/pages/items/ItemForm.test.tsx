import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ItemForm from './ItemForm';

const mockNavigate = vi.fn();
let mockParams: Record<string, string> = {};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => mockParams };
});

vi.mock('../../api/items', () => ({ itemsApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }));

import { itemsApi } from '../../api/items';

describe('ItemForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {};
  });

  it('renders create mode', () => {
    render(<BrowserRouter><ItemForm /></BrowserRouter>);
    expect(screen.getByRole('heading', { name: 'Create Item' })).toBeInTheDocument();
    expect(screen.getByText('Create Item', { selector: 'button' })).toBeInTheDocument();
  });

  it('renders edit mode and loads data', async () => {
    mockParams = { id: '1' };
    vi.mocked(itemsApi.get).mockResolvedValue({
      id: 1, name: 'Camera', version: '1.0', description: 'Desc', msrp: '999', min_price: '799',
    } as any);

    render(<BrowserRouter><ItemForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('Edit Item')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Camera')).toBeInTheDocument();
    expect(screen.getByDisplayValue('999')).toBeInTheDocument();
  });

  it('shows error on load failure in edit mode', async () => {
    mockParams = { id: '1' };
    vi.mocked(itemsApi.get).mockRejectedValue(new Error('load fail'));
    render(<BrowserRouter><ItemForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText('load fail')).toBeInTheDocument());
  });

  it('submits create form', async () => {
    vi.mocked(itemsApi.create).mockResolvedValue({ id: 1 } as any);
    render(<BrowserRouter><ItemForm /></BrowserRouter>);

    fireEvent.change(screen.getByLabelText(/Name/), { target: { name: 'name', value: 'Cam' } });
    fireEvent.change(screen.getByLabelText(/Version/), { target: { name: 'version', value: '1' } });
    fireEvent.change(screen.getByLabelText(/MSRP/), { target: { name: 'msrp', value: '9' } });
    fireEvent.change(screen.getByLabelText(/Minimum Price/), { target: { name: 'min_price', value: '7' } });
    fireEvent.submit(screen.getByText('Create Item', { selector: 'button' }).closest('form')!);

    await waitFor(() => expect(itemsApi.create).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/items');
  });

  it('submits edit form', async () => {
    mockParams = { id: '1' };
    vi.mocked(itemsApi.get).mockResolvedValue({
      id: 1, name: 'Cam', version: '1', msrp: '9', min_price: '7',
    } as any);
    vi.mocked(itemsApi.update).mockResolvedValue({ id: 1 } as any);

    render(<BrowserRouter><ItemForm /></BrowserRouter>);
    await waitFor(() => expect(screen.getByDisplayValue('Cam')).toBeInTheDocument());

    fireEvent.submit(screen.getByText('Update Item', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(itemsApi.update).toHaveBeenCalledWith(1, expect.any(Object)));
    expect(mockNavigate).toHaveBeenCalledWith('/items');
  });

  it('shows submit error', async () => {
    vi.mocked(itemsApi.create).mockRejectedValue(new Error('create fail'));
    render(<BrowserRouter><ItemForm /></BrowserRouter>);

    fireEvent.submit(screen.getByText('Create Item', { selector: 'button' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('create fail')).toBeInTheDocument());
  });

  it('navigates on cancel', async () => {
    render(<BrowserRouter><ItemForm /></BrowserRouter>);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/items');
  });
});
