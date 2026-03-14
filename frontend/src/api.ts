import apiClient from '@inator/shared/api/client';
import type { Item, PurchaseOrder, Order, Delivery, WaiveResponse, Attachment } from './types';

/** Paginated response wrapper from DRF. */
interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

/** Unwrap a paginated or flat array response. */
function unwrap<T>(data: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

/** Items CRUD endpoints. */
export const itemsApi = {
  list: async (): Promise<Item[]> => {
    const response = await apiClient.get<PaginatedResponse<Item> | Item[]>('/fulfil/items/');
    return unwrap(response.data);
  },
  get: async (id: number): Promise<Item> => {
    const response = await apiClient.get<Item>(`/fulfil/items/${String(id)}/`);
    return response.data;
  },
  create: async (data: Omit<Item, 'id'>): Promise<Item> => {
    const response = await apiClient.post<Item>('/fulfil/items/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<Item>): Promise<Item> => {
    const response = await apiClient.patch<Item>(`/fulfil/items/${String(id)}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/fulfil/items/${String(id)}/`);
  },
};

/** Purchase Order CRUD + workflow endpoints. */
export const posApi = {
  list: async (): Promise<PurchaseOrder[]> => {
    const response = await apiClient.get<PaginatedResponse<PurchaseOrder> | PurchaseOrder[]>(
      '/fulfil/purchase-orders/',
    );
    return unwrap(response.data);
  },
  get: async (id: number): Promise<PurchaseOrder> => {
    const response = await apiClient.get<PurchaseOrder>(`/fulfil/purchase-orders/${String(id)}/`);
    return response.data;
  },
  create: async (data: Omit<PurchaseOrder, 'id' | 'po_number'>): Promise<PurchaseOrder> => {
    const response = await apiClient.post<PurchaseOrder>('/fulfil/purchase-orders/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> => {
    const response = await apiClient.patch<PurchaseOrder>(
      `/fulfil/purchase-orders/${String(id)}/`,
      data,
    );
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/fulfil/purchase-orders/${String(id)}/`);
  },
  close: async (
    id: number,
    admin_override?: boolean,
    override_reason?: string,
  ): Promise<PurchaseOrder> => {
    const response = await apiClient.post<PurchaseOrder>(
      `/fulfil/purchase-orders/${String(id)}/close/`,
      { admin_override, override_reason },
    );
    return response.data;
  },
  waive: async (
    id: number,
    line_item_id: number,
    quantity_to_waive: number,
    reason?: string,
  ): Promise<WaiveResponse> => {
    const response = await apiClient.post<WaiveResponse>(
      `/fulfil/purchase-orders/${String(id)}/waive/`,
      { line_item_id, quantity_to_waive, reason },
    );
    return response.data;
  },
};

/** Order CRUD + workflow endpoints. */
export const ordersApi = {
  list: async (): Promise<Order[]> => {
    const response = await apiClient.get<PaginatedResponse<Order> | Order[]>('/fulfil/orders/');
    return unwrap(response.data);
  },
  get: async (id: number): Promise<Order> => {
    const response = await apiClient.get<Order>(`/fulfil/orders/${String(id)}/`);
    return response.data;
  },
  create: async (data: Omit<Order, 'id' | 'order_number'>): Promise<Order> => {
    const response = await apiClient.post<Order>('/fulfil/orders/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<Order>): Promise<Order> => {
    const response = await apiClient.patch<Order>(`/fulfil/orders/${String(id)}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/fulfil/orders/${String(id)}/`);
  },
  close: async (id: number, admin_override?: boolean, override_reason?: string): Promise<Order> => {
    const response = await apiClient.post<Order>(`/fulfil/orders/${String(id)}/close/`, {
      admin_override,
      override_reason,
    });
    return response.data;
  },
  waive: async (
    id: number,
    line_item_id: number,
    quantity_to_waive: number,
    reason?: string,
  ): Promise<WaiveResponse> => {
    const response = await apiClient.post<WaiveResponse>(`/fulfil/orders/${String(id)}/waive/`, {
      line_item_id,
      quantity_to_waive,
      reason,
    });
    return response.data;
  },
};

/** Delivery CRUD + workflow endpoints. */
export const deliveriesApi = {
  list: async (): Promise<Delivery[]> => {
    const response = await apiClient.get<PaginatedResponse<Delivery> | Delivery[]>(
      '/fulfil/deliveries/',
    );
    return unwrap(response.data);
  },
  get: async (id: number): Promise<Delivery> => {
    const response = await apiClient.get<Delivery>(`/fulfil/deliveries/${String(id)}/`);
    return response.data;
  },
  create: async (data: Omit<Delivery, 'id' | 'delivery_number'>): Promise<Delivery> => {
    const response = await apiClient.post<Delivery>('/fulfil/deliveries/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<Delivery>): Promise<Delivery> => {
    const response = await apiClient.patch<Delivery>(`/fulfil/deliveries/${String(id)}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/fulfil/deliveries/${String(id)}/`);
  },
  close: async (id: number): Promise<Delivery> => {
    const response = await apiClient.post<Delivery>(`/fulfil/deliveries/${String(id)}/close/`);
    return response.data;
  },
  searchSerial: async (serialNumber: string): Promise<Delivery> => {
    const response = await apiClient.get<Delivery>('/fulfil/deliveries/search_serial/', {
      params: { serial_number: serialNumber },
    });
    return response.data;
  },
};

/** Attachment endpoints (shared across PO, Order, Delivery). */
export const attachmentsApi = {
  list: async (contentType: string, objectId: number): Promise<Attachment[]> => {
    const response = await apiClient.get<{ results: Attachment[] }>(
      `/fulfil/attachments/?content_type=${contentType}&object_id=${String(objectId)}`,
    );
    return response.data.results;
  },
  upload: async (contentType: string, objectId: number, file: File): Promise<void> => {
    const formData = new FormData();
    formData.append('content_type', contentType);
    formData.append('object_id', String(objectId));
    formData.append('file', file);
    await apiClient.post('/fulfil/attachments/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/fulfil/attachments/${String(id)}/`);
  },
};
