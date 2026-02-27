import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ItemList from './ItemList';

vi.mock('../../api/items', () => ({ itemsApi: { list: vi.fn(), delete: vi.fn() } }));
vi.mock('../../hooks/useUser', () => ({ useUser: vi.fn() }));

import { itemsApi } from '../../api/items';
import { useUser } from '../../hooks/useUser';

const wrap = (ui: React.ReactNode) => <BrowserRouter>{ui}</BrowserRouter>;

describe('ItemList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUser).mockReturnValue({ user: null, loading: false, isAdmin: true });
  });

  it('shows loading then items', async () => {
    vi.mocked(itemsApi.list).mockResolvedValue([
      { id: 1, name: 'Camera', version: '1.0', msrp: '999', min_price: '799' } as any,
    ]);
    render(wrap(<ItemList />));
    // Loading spinner is shown initially (Loading component)
    await waitFor(() => expect(screen.getByText('Camera')).toBeInTheDocument());
    expect(screen.getByText('$999')).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    vi.mocked(itemsApi.list).mockResolvedValue([]);
    render(wrap(<ItemList />));
    await waitFor(() => expect(screen.getByText(/No items found/)).toBeInTheDocument());
  });

  it('shows error', async () => {
    vi.mocked(itemsApi.list).mockRejectedValue(new Error('fail'));
    render(wrap(<ItemList />));
    await waitFor(() => expect(screen.getByText('fail')).toBeInTheDocument());
  });

  it('shows Create button for admin', async () => {
    vi.mocked(itemsApi.list).mockResolvedValue([]);
    render(wrap(<ItemList />));
    await waitFor(() => expect(screen.getByText('Create Item')).toBeInTheDocument());
  });

  it('hides Create button for non-admin', async () => {
    vi.mocked(useUser).mockReturnValue({ user: null, loading: false, isAdmin: false });
    vi.mocked(itemsApi.list).mockResolvedValue([]);
    render(wrap(<ItemList />));
    await waitFor(() => expect(screen.getByText(/No items found/)).toBeInTheDocument());
    expect(screen.queryByText('Create Item')).not.toBeInTheDocument();
  });

  it('handles delete with confirm', async () => {
    vi.mocked(itemsApi.list).mockResolvedValue([
      { id: 1, name: 'Cam', version: '1', msrp: '9', min_price: '7' } as any,
    ]);
    vi.mocked(itemsApi.delete).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(wrap(<ItemList />));
    await waitFor(() => expect(screen.getByText('Cam')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    expect(itemsApi.delete).toHaveBeenCalledWith(1);
  });

  it('cancels delete', async () => {
    vi.mocked(itemsApi.list).mockResolvedValue([
      { id: 1, name: 'Cam', version: '1', msrp: '9', min_price: '7' } as any,
    ]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(wrap(<ItemList />));
    await waitFor(() => expect(screen.getByText('Cam')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    expect(itemsApi.delete).not.toHaveBeenCalled();
  });

  it('shows delete error', async () => {
    vi.mocked(itemsApi.list).mockResolvedValue([
      { id: 1, name: 'Cam', version: '1', msrp: '9', min_price: '7' } as any,
    ]);
    vi.mocked(itemsApi.delete).mockRejectedValue(new Error('del fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(wrap(<ItemList />));
    await waitFor(() => expect(screen.getByText('Cam')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(screen.getByText('del fail')).toBeInTheDocument());
  });
});
