import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import apiClient from './client';
import { posApi } from './pos';

describe('posApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('list', () => {
    it('handles paginated response', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { results: [{ id: 1 }], count: 1, next: null, previous: null },
      });
      expect(await posApi.list()).toEqual([{ id: 1 }]);
      expect(apiClient.get).toHaveBeenCalledWith('/purchase-orders/');
    });

    it('handles array response', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 1 }] });
      expect(await posApi.list()).toEqual([{ id: 1 }]);
    });
  });

  it('get', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 1 } });
    expect(await posApi.get(1)).toEqual({ id: 1 });
    expect(apiClient.get).toHaveBeenCalledWith('/purchase-orders/1/');
  });

  it('create', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } });
    await posApi.create({} as any);
    expect(apiClient.post).toHaveBeenCalledWith('/purchase-orders/', {});
  });

  it('update', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: 1 } });
    await posApi.update(1, { notes: 'x' });
    expect(apiClient.patch).toHaveBeenCalledWith('/purchase-orders/1/', { notes: 'x' });
  });

  it('delete', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});
    await posApi.delete(1);
    expect(apiClient.delete).toHaveBeenCalledWith('/purchase-orders/1/');
  });

  it('close', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1, status: 'CLOSED' } });
    await posApi.close(1, true, 'reason');
    expect(apiClient.post).toHaveBeenCalledWith('/purchase-orders/1/close/', {
      admin_override: true,
      override_reason: 'reason',
    });
  });

  it('waive', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'ok' } });
    await posApi.waive(1, 2, 3, 'reason');
    expect(apiClient.post).toHaveBeenCalledWith('/purchase-orders/1/waive/', {
      line_item_id: 2,
      quantity_to_waive: 3,
      reason: 'reason',
    });
  });
});
