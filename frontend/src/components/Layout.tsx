import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { redirectToServices, handleLogout } from '../utils/auth';
import { useUser } from '../hooks/useUser';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user } = useUser();

  const navItems = [
    { path: '/items', label: 'Items' },
    { path: '/pos', label: 'Purchase Orders' },
    { path: '/orders', label: 'Orders' },
    { path: '/deliveries', label: 'Deliveries' },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Top Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">📦 FULFILinator</h1>
              <span className="ml-4 text-sm text-gray-500">Order Fulfillment</span>
            </div>
            {user && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.username}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <button
                  onClick={redirectToServices}
                  className="px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  ← Services
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-lg flex flex-col border-r border-gray-200">
        <nav className="mt-6 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-6 py-3 text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
