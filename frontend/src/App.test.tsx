import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./utils/auth', () => ({
  getToken: vi.fn(),
  setToken: vi.fn(),
  redirectToLogin: vi.fn(),
}));

vi.mock('./hooks/useUser', () => ({
  useUser: vi.fn(() => ({ user: null, loading: false, isAdmin: false })),
}));

// Stub heavy child components
vi.mock('./components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));
vi.mock('./pages/items/ItemList', () => ({ default: () => <div>ItemList</div> }));
vi.mock('./pages/items/ItemForm', () => ({ default: () => <div>ItemForm</div> }));
vi.mock('./pages/pos/POList', () => ({ default: () => <div>POList</div> }));
vi.mock('./pages/pos/POForm', () => ({ default: () => <div>POForm</div> }));
vi.mock('./pages/pos/PODetail', () => ({ default: () => <div>PODetail</div> }));
vi.mock('./pages/orders/OrderList', () => ({ default: () => <div>OrderList</div> }));
vi.mock('./pages/orders/OrderForm', () => ({ default: () => <div>OrderForm</div> }));
vi.mock('./pages/orders/OrderDetail', () => ({ default: () => <div>OrderDetail</div> }));
vi.mock('./pages/deliveries/DeliveryList', () => ({ default: () => <div>DeliveryList</div> }));
vi.mock('./pages/deliveries/DeliveryForm', () => ({ default: () => <div>DeliveryForm</div> }));
vi.mock('./pages/deliveries/DeliveryDetail', () => ({ default: () => <div>DeliveryDetail</div> }));
vi.mock('./pages/deliveries/SerialSearch', () => ({ default: () => <div>SerialSearch</div> }));

import { getToken, setToken, redirectToLogin } from './utils/auth';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: has a token in localStorage
    vi.mocked(getToken).mockReturnValue('test-token');
  });

  it('renders app when token exists', () => {
    render(<App />);
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('redirects to login when no token', () => {
    vi.mocked(getToken).mockReturnValue(null);
    render(<App />);
    expect(redirectToLogin).toHaveBeenCalled();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles token from URL parameter', () => {
    vi.mocked(getToken).mockReturnValue(null);
    // Set URL to include token param
    window.history.pushState(null, '', '/?token=url-token');
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(<App />);

    expect(setToken).toHaveBeenCalledWith('url-token');
    expect(replaceStateSpy).toHaveBeenCalled();
    expect(screen.getByTestId('layout')).toBeInTheDocument();

    replaceStateSpy.mockRestore();
    window.history.pushState(null, '', '/');
  });

  it('navigates to /items by default (redirect from /)', () => {
    render(<App />);
    // The root route redirects to /items, which renders the stubbed ItemList
    expect(screen.getByText('ItemList')).toBeInTheDocument();
  });
});
