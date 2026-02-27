import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SerialSearch from './SerialSearch';

vi.mock('../../api/deliveries', () => ({ deliveriesApi: { searchSerial: vi.fn() } }));

import { deliveriesApi } from '../../api/deliveries';

const wrap = (ui: React.ReactNode) => <BrowserRouter>{ui}</BrowserRouter>;

describe('SerialSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search form', () => {
    render(wrap(<SerialSearch />));
    expect(screen.getByText('Search by Serial Number')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('validates empty input', async () => {
    render(wrap(<SerialSearch />));
    fireEvent.submit(screen.getByText('Search').closest('form')!);
    await waitFor(() => expect(screen.getByText('Please enter a serial number')).toBeInTheDocument());
  });

  it('shows search result', async () => {
    vi.mocked(deliveriesApi.searchSerial).mockResolvedValue({
      id: 1, delivery_number: 'DEL-001', customer_id: 'C1',
      ship_date: '2026-01-15', tracking_number: 'T123', status: 'OPEN',
      line_items: [],
    } as any);

    render(wrap(<SerialSearch />));
    fireEvent.change(screen.getByLabelText(/Serial Number/), { target: { value: 'SN-001' } });
    fireEvent.submit(screen.getByText('Search').closest('form')!);

    await waitFor(() => expect(screen.getByText('DEL-001')).toBeInTheDocument());
    expect(screen.getByText(/Serial number found/)).toBeInTheDocument();
    expect(screen.getByText('C1')).toBeInTheDocument();
    expect(screen.getByText('T123')).toBeInTheDocument();
  });

  it('shows not found error for 404', async () => {
    vi.mocked(deliveriesApi.searchSerial).mockRejectedValue({ response: { status: 404 } });

    render(wrap(<SerialSearch />));
    fireEvent.change(screen.getByLabelText(/Serial Number/), { target: { value: 'SN-NONE' } });
    fireEvent.submit(screen.getByText('Search').closest('form')!);

    await waitFor(() => expect(screen.getByText('Serial number not found')).toBeInTheDocument());
  });

  it('shows generic error', async () => {
    vi.mocked(deliveriesApi.searchSerial).mockRejectedValue(new Error('server error'));

    render(wrap(<SerialSearch />));
    fireEvent.change(screen.getByLabelText(/Serial Number/), { target: { value: 'SN-ERR' } });
    fireEvent.submit(screen.getByText('Search').closest('form')!);

    await waitFor(() => expect(screen.getByText('server error')).toBeInTheDocument());
  });

  it('shows result without tracking number', async () => {
    vi.mocked(deliveriesApi.searchSerial).mockResolvedValue({
      id: 1, delivery_number: 'DEL-002', customer_id: 'C2',
      ship_date: '2026-01-20', status: 'CLOSED', line_items: [],
    } as any);

    render(wrap(<SerialSearch />));
    fireEvent.change(screen.getByLabelText(/Serial Number/), { target: { value: 'SN-002' } });
    fireEvent.submit(screen.getByText('Search').closest('form')!);

    await waitFor(() => expect(screen.getByText('DEL-002')).toBeInTheDocument());
    expect(screen.getByText('CLOSED')).toBeInTheDocument();
  });

  it('shows View Full Delivery Details link', async () => {
    vi.mocked(deliveriesApi.searchSerial).mockResolvedValue({
      id: 5, delivery_number: 'DEL-005', customer_id: 'C1',
      ship_date: '2026-01-15', status: 'OPEN', line_items: [],
    } as any);

    render(wrap(<SerialSearch />));
    fireEvent.change(screen.getByLabelText(/Serial Number/), { target: { value: 'SN-005' } });
    fireEvent.submit(screen.getByText('Search').closest('form')!);

    await waitFor(() => expect(screen.getByText('View Full Delivery Details')).toBeInTheDocument());
  });
});
