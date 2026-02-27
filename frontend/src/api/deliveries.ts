import apiClient from './client';
import { Delivery } from './types';

interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

export const deliveriesApi = {
  list: async (): Promise<Delivery[]> => {
    const response = await apiClient.get<PaginatedResponse<Delivery> | Delivery[]>('/deliveries/');
    // Handle both paginated and non-paginated responses
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data.results;
  },

  get: async (id: number): Promise<Delivery> => {
    const response = await apiClient.get<Delivery>(`/deliveries/${id}/`);
    return response.data;
  },

  create: async (data: Omit<Delivery, 'id' | 'delivery_number'>): Promise<Delivery> => {
    const response = await apiClient.post<Delivery>('/deliveries/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Delivery>): Promise<Delivery> => {
    const response = await apiClient.patch<Delivery>(`/deliveries/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/deliveries/${id}/`);
  },

  close: async (id: number): Promise<Delivery> => {
    const response = await apiClient.post<Delivery>(`/deliveries/${id}/close/`);
    return response.data;
  },

  searchSerial: async (serialNumber: string): Promise<Delivery> => {
    const response = await apiClient.get<Delivery>(`/deliveries/search_serial/`, {
      params: { serial_number: serialNumber },
    });
    return response.data;
  },
};
