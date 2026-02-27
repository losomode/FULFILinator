import { useState, useEffect } from 'react';
import { getToken } from '../utils/auth';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  customer_id?: number;
  customer_name?: string;
}

export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const authUrl = import.meta.env.VITE_AUTHINATOR_URL || 'http://localhost:8001';
        const response = await fetch(`${authUrl}/api/auth/me/`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const isAdmin = user?.role === 'ADMIN';

  return {
    user,
    loading,
    isAdmin,
  };
};
