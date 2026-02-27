import apiClient from './client';
import { PurchaseOrder, WaiveResponse } from './types';

interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

export const posApi = {
  list: async (): Promise<PurchaseOrder[]> => {
    const response = await apiClient.get<PaginatedResponse<PurchaseOrder> | PurchaseOrder[]>('/purchase-orders/');
    // Handle both paginated and non-paginated responses
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data.results;
  },

  get: async (id: number): Promise<PurchaseOrder> => {
    const response = await apiClient.get<PurchaseOrder>(`/purchase-orders/${id}/`);
    return response.data;
  },

  create: async (data: Omit<PurchaseOrder, 'id' | 'po_number'>): Promise<PurchaseOrder> => {
    const response = await apiClient.post<PurchaseOrder>('/purchase-orders/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> => {
    const response = await apiClient.patch<PurchaseOrder>(`/purchase-orders/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/purchase-orders/${id}/`);
  },

  close: async (id: number, admin_override?: boolean, override_reason?: string): Promise<PurchaseOrder> => {
    const response = await apiClient.post<PurchaseOrder>(`/purchase-orders/${id}/close/`, {
      admin_override,
      override_reason,
    });
    return response.data;
  },

  waive: async (id: number, line_item_id: number, quantity_to_waive: number, reason?: string): Promise<WaiveResponse> => {
    const response = await apiClient.post(`/purchase-orders/${id}/waive/`, {
      line_item_id,
      quantity_to_waive,
      reason,
    });
    return response.data;
  },
};
