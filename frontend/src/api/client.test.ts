import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/auth', () => ({
  getToken: vi.fn(),
  redirectToLogin: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

import axios from 'axios';
// Importing the module triggers interceptor setup
import './client';
import { getToken, redirectToLogin } from '../utils/auth';

// Extract interceptor callbacks captured by the mock
const mockApiClient = vi.mocked(axios.create).mock.results[0].value as any;
const [reqFulfilled, reqRejected] = mockApiClient.interceptors.request.use.mock.calls[0];
const [resFulfilled, resRejected] = mockApiClient.interceptors.response.use.mock.calls[0];

describe('apiClient', () => {
  beforeEach(() => {
    vi.mocked(getToken).mockReset();
    vi.mocked(redirectToLogin).mockReset();
  });

  it('creates instance with correct config', () => {
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:8003/api/fulfil',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('adds auth header when token exists', () => {
    vi.mocked(getToken).mockReturnValue('tok');
    const config = { headers: {} as Record<string, string> };
    expect(reqFulfilled(config).headers.Authorization).toBe('Bearer tok');
  });

  it('skips auth header when no token', () => {
    vi.mocked(getToken).mockReturnValue(null);
    const config = { headers: {} as Record<string, string> };
    expect(reqFulfilled(config).headers.Authorization).toBeUndefined();
  });

  it('rejects request errors', async () => {
    await expect(reqRejected(new Error('fail'))).rejects.toThrow('fail');
  });

  it('passes through successful responses', () => {
    const resp = { data: 'ok' };
    expect(resFulfilled(resp)).toBe(resp);
  });

  it('redirects to login on 401', async () => {
    const err = { response: { status: 401 } };
    await expect(resRejected(err)).rejects.toBe(err);
    expect(redirectToLogin).toHaveBeenCalled();
  });

  it('does not redirect for non-401', async () => {
    const err = { response: { status: 500 } };
    await expect(resRejected(err)).rejects.toBe(err);
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('does not redirect when no response on error', async () => {
    const err = new Error('network');
    await expect(resRejected(err)).rejects.toBe(err);
    expect(redirectToLogin).not.toHaveBeenCalled();
  });
});
