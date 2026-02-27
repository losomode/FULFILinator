import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DeliveryList from './DeliveryList';

vi.mock('../../api/deliveries', () => ({ deliveriesApi: { list: vi.fn(), delete: vi.fn() } }));
vi.mock('../../hooks/useUser', () => ({ useUser: vi.fn() }));

import { deliveriesApi } from '../../api/deliveries';
import { useUser } from '../../hooks/useUser';

const wrap = (ui: React.ReactNode) => <BrowserRouter>{ui}</BrowserRouter>;

const mockDelivery = {
  id: 1, delivery_number: 'DEL-001', customer_id: 'C1', customer_name: 'Acme',
  ship_date: '2026-01-15', tracking_number: 'TRACK123', status: 'OPEN' as const,
  line_items: [{ item: 1, serial_number: 'SN1' }],
};

describe('DeliveryList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUser).mockReturnValue({ user: null, loading: false, isAdmin: true });
  });

  it('shows deliveries', async () => {
    vi.mocked(deliveriesApi.list).mockResolvedValue([mockDelivery as any]);
    render(wrap(<DeliveryList />));
    await waitFor(() => expect(screen.getByText('DEL-001')).toBeInTheDocument());
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('TRACK123')).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    vi.mocked(deliveriesApi.list).mockResolvedValue([]);
    render(wrap(<DeliveryList />));
    await waitFor(() => expect(screen.getByText(/No deliveries found/)).toBeInTheDocument());
  });

  it('shows error', async () => {
    vi.mocked(deliveriesApi.list).mockRejectedValue(new Error('fail'));
    render(wrap(<DeliveryList />));
    await waitFor(() => expect(screen.getByText('fail')).toBeInTheDocument());
  });

  it('hides admin actions for non-admin', async () => {
    vi.mocked(useUser).mockReturnValue({ user: null, loading: false, isAdmin: false });
    vi.mocked(deliveriesApi.list).mockResolvedValue([]);
    render(wrap(<DeliveryList />));
    await waitFor(() => expect(screen.getByText(/No deliveries found/)).toBeInTheDocument());
    expect(screen.queryByText('Create Delivery')).not.toBeInTheDocument();
  });

  it('handles delete', async () => {
    vi.mocked(deliveriesApi.list).mockResolvedValue([mockDelivery as any]);
    vi.mocked(deliveriesApi.delete).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(wrap(<DeliveryList />));
    await waitFor(() => expect(screen.getByText('DEL-001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    expect(deliveriesApi.delete).toHaveBeenCalledWith(1);
  });

  it('cancels delete', async () => {
    vi.mocked(deliveriesApi.list).mockResolvedValue([mockDelivery as any]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(wrap(<DeliveryList />));
    await waitFor(() => expect(screen.getByText('DEL-001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    expect(deliveriesApi.delete).not.toHaveBeenCalled();
  });

  it('shows delete error', async () => {
    vi.mocked(deliveriesApi.list).mockResolvedValue([mockDelivery as any]);
    vi.mocked(deliveriesApi.delete).mockRejectedValue(new Error('del err'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(wrap(<DeliveryList />));
    await waitFor(() => expect(screen.getByText('DEL-001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(screen.getByText('del err')).toBeInTheDocument());
  });

  it('shows N/A when no tracking number', async () => {
    vi.mocked(deliveriesApi.list).mockResolvedValue([{ ...mockDelivery, tracking_number: undefined } as any]);
    render(wrap(<DeliveryList />));
    await waitFor(() => expect(screen.getByText('N/A')).toBeInTheDocument());
  });

  it('shows Search Serial Numbers link', async () => {
    vi.mocked(deliveriesApi.list).mockResolvedValue([]);
    render(wrap(<DeliveryList />));
    await waitFor(() => expect(screen.getByText('Search Serial Numbers')).toBeInTheDocument());
  });
});
