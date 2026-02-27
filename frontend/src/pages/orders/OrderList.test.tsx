import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import OrderList from './OrderList';

vi.mock('../../api/orders', () => ({ ordersApi: { list: vi.fn(), delete: vi.fn() } }));
vi.mock('../../hooks/useUser', () => ({ useUser: vi.fn() }));

import { ordersApi } from '../../api/orders';
import { useUser } from '../../hooks/useUser';

const wrap = (ui: React.ReactNode) => <BrowserRouter>{ui}</BrowserRouter>;

const mockOrder = {
  id: 1, order_number: 'ORD-001', customer_id: 'C1', customer_name: 'Acme',
  status: 'OPEN' as const, line_items: [{ item: 1, quantity: 5 }],
  created_at: '2026-01-01T00:00:00Z',
};

describe('OrderList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUser).mockReturnValue({ user: null, loading: false, isAdmin: true });
  });

  it('shows orders', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue([mockOrder as any]);
    render(wrap(<OrderList />));
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue([]);
    render(wrap(<OrderList />));
    await waitFor(() => expect(screen.getByText(/No orders found/)).toBeInTheDocument());
  });

  it('shows error', async () => {
    vi.mocked(ordersApi.list).mockRejectedValue(new Error('fail'));
    render(wrap(<OrderList />));
    await waitFor(() => expect(screen.getByText('fail')).toBeInTheDocument());
  });

  it('hides admin actions for non-admin', async () => {
    vi.mocked(useUser).mockReturnValue({ user: null, loading: false, isAdmin: false });
    vi.mocked(ordersApi.list).mockResolvedValue([]);
    render(wrap(<OrderList />));
    await waitFor(() => expect(screen.getByText(/No orders found/)).toBeInTheDocument());
    expect(screen.queryByText('Create Order')).not.toBeInTheDocument();
  });

  it('handles delete', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue([mockOrder as any]);
    vi.mocked(ordersApi.delete).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(wrap(<OrderList />));
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    expect(ordersApi.delete).toHaveBeenCalledWith(1);
  });

  it('cancels delete', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue([mockOrder as any]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(wrap(<OrderList />));
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    expect(ordersApi.delete).not.toHaveBeenCalled();
  });

  it('shows delete error', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue([mockOrder as any]);
    vi.mocked(ordersApi.delete).mockRejectedValue(new Error('del err'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(wrap(<OrderList />));
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(screen.getByText('del err')).toBeInTheDocument());
  });

  it('shows customer_id when no customer_name', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue([{ ...mockOrder, customer_name: undefined } as any]);
    render(wrap(<OrderList />));
    await waitFor(() => expect(screen.getByText('C1')).toBeInTheDocument());
  });

  it('shows N/A when no created_at', async () => {
    vi.mocked(ordersApi.list).mockResolvedValue([{ ...mockOrder, created_at: undefined } as any]);
    render(wrap(<OrderList />));
    await waitFor(() => expect(screen.getByText('N/A')).toBeInTheDocument());
  });
});
