import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getToken, setToken, clearToken, redirectToLogin, redirectToServices, handleLogout } from './auth';

describe('auth utils', () => {
  beforeEach(() => {
    localStorage.clear();
    // Replace window.location with a plain object so jsdom doesn't throw on navigation
    vi.stubGlobal('location', {
      href: 'http://localhost:3000/test',
      pathname: '/test',
      search: '',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getToken', () => {
    it('returns null when no token', () => {
      expect(getToken()).toBeNull();
    });

    it('returns stored token', () => {
      localStorage.setItem('auth_token', 'tok-123');
      expect(getToken()).toBe('tok-123');
    });
  });

  describe('setToken', () => {
    it('stores token in localStorage', () => {
      setToken('my-token');
      expect(localStorage.getItem('auth_token')).toBe('my-token');
    });
  });

  describe('clearToken', () => {
    it('removes token', () => {
      localStorage.setItem('auth_token', 'x');
      clearToken();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  describe('redirectToLogin', () => {
    it('sets location to Authinator login with redirect', () => {
      redirectToLogin();
      expect(window.location.href).toContain('/login?redirect=');
    });
  });

  describe('redirectToServices', () => {
    it('sets location to Authinator base', () => {
      redirectToServices();
      expect(window.location.href).toContain('localhost:3001');
    });
  });

  describe('handleLogout', () => {
    it('clears token and redirects', () => {
      localStorage.setItem('auth_token', 'x');
      handleLogout();
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(window.location.href).toContain('/login?redirect=');
    });
  });
});
