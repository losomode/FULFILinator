import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import apiClient from './client';
import { itemsApi } from './items';

describe('itemsApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('list', () => {
    it('handles paginated response', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { results: [{ id: 1 }], count: 1, next: null, previous: null },
      });
      expect(await itemsApi.list()).toEqual([{ id: 1 }]);
      expect(apiClient.get).toHaveBeenCalledWith('/items/');
    });

    it('handles array response', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 1 }] });
      expect(await itemsApi.list()).toEqual([{ id: 1 }]);
    });
  });

  it('get', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 1 } });
    expect(await itemsApi.get(1)).toEqual({ id: 1 });
    expect(apiClient.get).toHaveBeenCalledWith('/items/1/');
  });

  it('create', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } });
    await itemsApi.create({ name: 'X', version: '1', msrp: '9', min_price: '7' } as any);
    expect(apiClient.post).toHaveBeenCalledWith('/items/', expect.any(Object));
  });

  it('update', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: 1 } });
    await itemsApi.update(1, { name: 'Y' });
    expect(apiClient.patch).toHaveBeenCalledWith('/items/1/', { name: 'Y' });
  });

  it('delete', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});
    await itemsApi.delete(1);
    expect(apiClient.delete).toHaveBeenCalledWith('/items/1/');
  });
});
