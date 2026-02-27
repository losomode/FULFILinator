import apiClient from './client';
import { Item } from './types';

interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

export const itemsApi = {
  list: async (): Promise<Item[]> => {
    const response = await apiClient.get<PaginatedResponse<Item> | Item[]>('/items/');
    // Handle both paginated and non-paginated responses
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data.results;
  },

  get: async (id: number): Promise<Item> => {
    const response = await apiClient.get<Item>(`/items/${id}/`);
    return response.data;
  },

  create: async (data: Omit<Item, 'id'>): Promise<Item> => {
    const response = await apiClient.post<Item>('/items/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Item>): Promise<Item> => {
    const response = await apiClient.patch<Item>(`/items/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/items/${id}/`);
  },
};
