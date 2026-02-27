import axios from 'axios';
import { getToken, redirectToLogin } from '../utils/auth';

const apiClient = axios.create({
  baseURL: 'http://localhost:8003/api/fulfil',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle authentication errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid or expired, redirect to Authinator login
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
