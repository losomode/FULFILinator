import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';

vi.mock('../hooks/useUser', () => ({
  useUser: vi.fn(),
}));

vi.mock('../utils/auth', () => ({
  redirectToServices: vi.fn(),
  handleLogout: vi.fn(),
}));

import { useUser } from '../hooks/useUser';
import { redirectToServices, handleLogout } from '../utils/auth';

describe('Layout', () => {
  it('renders nav items and children', () => {
    vi.mocked(useUser).mockReturnValue({ user: null, loading: false, isAdmin: false });
    render(
      <MemoryRouter initialEntries={['/items']}>
        <Layout><div>Content</div></Layout>
      </MemoryRouter>
    );
    expect(screen.getByText('Items')).toBeInTheDocument();
    expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Deliveries')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('shows user info when logged in', () => {
    vi.mocked(useUser).mockReturnValue({
      user: { id: 1, username: 'admin', email: 'a@t.com', role: 'ADMIN' } as any,
      loading: false, isAdmin: true,
    });
    render(
      <MemoryRouter><Layout><div /></Layout></MemoryRouter>
    );
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('a@t.com')).toBeInTheDocument();
  });

  it('does not show user block when no user', () => {
    vi.mocked(useUser).mockReturnValue({ user: null, loading: false, isAdmin: false });
    render(
      <MemoryRouter><Layout><div /></Layout></MemoryRouter>
    );
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  it('calls redirectToServices on Services button', () => {
    vi.mocked(useUser).mockReturnValue({
      user: { id: 1, username: 'u', email: 'e', role: 'ADMIN' } as any,
      loading: false, isAdmin: true,
    });
    render(
      <MemoryRouter><Layout><div /></Layout></MemoryRouter>
    );
    fireEvent.click(screen.getByText('← Services'));
    expect(redirectToServices).toHaveBeenCalled();
  });

  it('calls handleLogout on Logout button', () => {
    vi.mocked(useUser).mockReturnValue({
      user: { id: 1, username: 'u', email: 'e', role: 'ADMIN' } as any,
      loading: false, isAdmin: true,
    });
    render(
      <MemoryRouter><Layout><div /></Layout></MemoryRouter>
    );
    fireEvent.click(screen.getByText('Logout'));
    expect(handleLogout).toHaveBeenCalled();
  });

  it('highlights active nav item', () => {
    vi.mocked(useUser).mockReturnValue({ user: null, loading: false, isAdmin: false });
    render(
      <MemoryRouter initialEntries={['/items']}>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    const itemsLink = screen.getByText('Items');
    expect(itemsLink.className).toContain('bg-blue-50');
  });
});
