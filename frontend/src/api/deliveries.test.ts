import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import apiClient from './client';
import { deliveriesApi } from './deliveries';

describe('deliveriesApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('list', () => {
    it('handles paginated response', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { results: [{ id: 1 }], count: 1, next: null, previous: null },
      });
      expect(await deliveriesApi.list()).toEqual([{ id: 1 }]);
      expect(apiClient.get).toHaveBeenCalledWith('/deliveries/');
    });

    it('handles array response', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 1 }] });
      expect(await deliveriesApi.list()).toEqual([{ id: 1 }]);
    });
  });

  it('get', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 1 } });
    expect(await deliveriesApi.get(1)).toEqual({ id: 1 });
    expect(apiClient.get).toHaveBeenCalledWith('/deliveries/1/');
  });

  it('create', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } });
    await deliveriesApi.create({} as any);
    expect(apiClient.post).toHaveBeenCalledWith('/deliveries/', {});
  });

  it('update', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: 1 } });
    await deliveriesApi.update(1, { notes: 'x' });
    expect(apiClient.patch).toHaveBeenCalledWith('/deliveries/1/', { notes: 'x' });
  });

  it('delete', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});
    await deliveriesApi.delete(1);
    expect(apiClient.delete).toHaveBeenCalledWith('/deliveries/1/');
  });

  it('close', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1, status: 'CLOSED' } });
    await deliveriesApi.close(1);
    expect(apiClient.post).toHaveBeenCalledWith('/deliveries/1/close/');
  });

  it('searchSerial', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 1 } });
    await deliveriesApi.searchSerial('SN123');
    expect(apiClient.get).toHaveBeenCalledWith('/deliveries/search_serial/', {
      params: { serial_number: 'SN123' },
    });
  });
});
