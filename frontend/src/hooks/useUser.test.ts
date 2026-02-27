import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../utils/auth', () => ({
  getToken: vi.fn(),
}));

import { getToken } from '../utils/auth';
import { useUser } from './useUser';

describe('useUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('sets loading false when no token', async () => {
    vi.mocked(getToken).mockReturnValue(null);
    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('fetches ADMIN user when token exists', async () => {
    vi.mocked(getToken).mockReturnValue('tok');
    const user = { id: 1, username: 'admin', email: 'a@t.com', role: 'ADMIN' };
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve(user) } as Response);

    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(user);
    expect(result.current.isAdmin).toBe(true);
  });

  it('fetches USER role', async () => {
    vi.mocked(getToken).mockReturnValue('tok');
    const user = { id: 1, username: 'user', email: 'u@t.com', role: 'USER' };
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve(user) } as Response);

    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(user);
    expect(result.current.isAdmin).toBe(false);
  });

  it('handles non-ok response', async () => {
    vi.mocked(getToken).mockReturnValue('tok');
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as Response);

    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('handles fetch error', async () => {
    vi.mocked(getToken).mockReturnValue('tok');
    vi.mocked(global.fetch).mockRejectedValue(new Error('net'));

    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });
});
