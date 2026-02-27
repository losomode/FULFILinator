import apiClient from './client';
import { Order, WaiveResponse } from './types';

interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

export const ordersApi = {
  list: async (): Promise<Order[]> => {
    const response = await apiClient.get<PaginatedResponse<Order> | Order[]>('/orders/');
    // Handle both paginated and non-paginated responses
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data.results;
  },

  get: async (id: number): Promise<Order> => {
    const response = await apiClient.get<Order>(`/orders/${id}/`);
    return response.data;
  },

  create: async (data: Omit<Order, 'id' | 'order_number'>): Promise<Order> => {
    const response = await apiClient.post<Order>('/orders/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Order>): Promise<Order> => {
    const response = await apiClient.patch<Order>(`/orders/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/orders/${id}/`);
  },

  close: async (id: number, admin_override?: boolean, override_reason?: string): Promise<Order> => {
    const response = await apiClient.post<Order>(`/orders/${id}/close/`, {
      admin_override,
      override_reason,
    });
    return response.data;
  },

  waive: async (id: number, line_item_id: number, quantity_to_waive: number, reason?: string): Promise<WaiveResponse> => {
    const response = await apiClient.post(`/orders/${id}/waive/`, {
      line_item_id,
      quantity_to_waive,
      reason,
    });
    return response.data;
  },
};
