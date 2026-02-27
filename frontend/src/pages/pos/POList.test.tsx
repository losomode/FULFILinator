import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import POList from './POList';

vi.mock('../../api/pos', () => ({ posApi: { list: vi.fn(), delete: vi.fn() } }));
vi.mock('../../hooks/useUser', () => ({ useUser: vi.fn() }));

import { posApi } from '../../api/pos';
import { useUser } from '../../hooks/useUser';

const wrap = (ui: React.ReactNode) => <BrowserRouter>{ui}</BrowserRouter>;

const mockPO = {
  id: 1, po_number: 'PO-001', customer_id: 'C1', customer_name: 'Acme',
  start_date: '2026-01-01', status: 'OPEN' as const, line_items: [{ id: 1, item: 1, quantity: 5, price_per_unit: '9' }],
};

describe('POList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUser).mockReturnValue({ user: null, loading: false, isAdmin: true });
  });

  it('shows POs', async () => {
    vi.mocked(posApi.list).mockResolvedValue([mockPO as any]);
    render(wrap(<POList />));
    await waitFor(() => expect(screen.getByText('PO-001')).toBeInTheDocument());
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('OPEN')).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    vi.mocked(posApi.list).mockResolvedValue([]);
    render(wrap(<POList />));
    await waitFor(() => expect(screen.getByText(/No purchase orders found/)).toBeInTheDocument());
  });

  it('shows error', async () => {
    vi.mocked(posApi.list).mockRejectedValue(new Error('fail'));
    render(wrap(<POList />));
    await waitFor(() => expect(screen.getByText('fail')).toBeInTheDocument());
  });

  it('hides admin actions for non-admin', async () => {
    vi.mocked(useUser).mockReturnValue({ user: null, loading: false, isAdmin: false });
    vi.mocked(posApi.list).mockResolvedValue([]);
    render(wrap(<POList />));
    await waitFor(() => expect(screen.getByText(/No purchase orders found/)).toBeInTheDocument());
    expect(screen.queryByText('Create PO')).not.toBeInTheDocument();
  });

  it('handles delete', async () => {
    vi.mocked(posApi.list).mockResolvedValue([mockPO as any]);
    vi.mocked(posApi.delete).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(wrap(<POList />));
    await waitFor(() => expect(screen.getByText('PO-001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    expect(posApi.delete).toHaveBeenCalledWith(1);
  });

  it('cancels delete', async () => {
    vi.mocked(posApi.list).mockResolvedValue([mockPO as any]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(wrap(<POList />));
    await waitFor(() => expect(screen.getByText('PO-001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    expect(posApi.delete).not.toHaveBeenCalled();
  });

  it('shows delete error', async () => {
    vi.mocked(posApi.list).mockResolvedValue([mockPO as any]);
    vi.mocked(posApi.delete).mockRejectedValue(new Error('del err'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(wrap(<POList />));
    await waitFor(() => expect(screen.getByText('PO-001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(screen.getByText('del err')).toBeInTheDocument());
  });

  it('shows customer_id when no customer_name', async () => {
    vi.mocked(posApi.list).mockResolvedValue([{ ...mockPO, customer_name: undefined } as any]);
    render(wrap(<POList />));
    await waitFor(() => expect(screen.getByText('C1')).toBeInTheDocument());
  });

  it('shows N/A when no start_date', async () => {
    vi.mocked(posApi.list).mockResolvedValue([{ ...mockPO, start_date: undefined } as any]);
    render(wrap(<POList />));
    await waitFor(() => expect(screen.getByText('N/A')).toBeInTheDocument());
  });
});
