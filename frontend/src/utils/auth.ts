const AUTH_TOKEN_KEY = 'auth_token';
const AUTHINATOR_URL = import.meta.env.VITE_AUTHINATOR_FRONTEND_URL || 'http://localhost:3001';

export const getToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const setToken = (token: string): void => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearToken = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const redirectToLogin = (): void => {
  const currentUrl = window.location.href;
  window.location.href = `${AUTHINATOR_URL}/login?redirect=${encodeURIComponent(currentUrl)}`;
};

export const redirectToServices = (): void => {
  window.location.href = AUTHINATOR_URL;
};

export const handleLogout = (): void => {
  clearToken();
  redirectToLogin();
};
