import { getAxiosErrorData } from '@inator/shared/types';

/** Fulfil catalog item. */
export interface Item {
  id: number;
  name: string;
  version: string;
  description?: string;
  msrp: string;
  min_price: string;
  created_at?: string;
  created_by_user_id?: string;
}

/** File attached to a PO, Order, or Delivery. */
export interface Attachment {
  id: number;
  content_type: 'PO' | 'ORDER' | 'DELIVERY';
  object_id: number;
  file: string;
  filename: string;
  file_size: number;
  uploaded_at: string;
  uploaded_by_user_id: string;
  file_extension: string;
  file_size_mb: number;
  is_image: boolean;
  is_pdf: boolean;
  is_spreadsheet: boolean;
}

/** A line item on a Purchase Order. */
export interface POLineItem {
  id?: number;
  item: number;
  quantity: number;
  price_per_unit: string;
  notes?: string;
}

/** Fulfillment tracking for a single line item. */
export interface FulfillmentLineItem {
  line_item_id: number;
  item_id: number;
  item_name: string;
  original_quantity: number;
  ordered_quantity?: number;
  delivered_quantity?: number;
  waived_quantity?: number;
  remaining_quantity: number;
  price_per_unit: string;
}

/** PO-level fulfillment status with linked orders. */
export interface POFulfillmentStatus {
  line_items: FulfillmentLineItem[];
  orders: Array<{ order_id: number; order_number: string }>;
}

/** Order-level fulfillment status with linked deliveries and source POs. */
export interface OrderFulfillmentStatus {
  line_items: FulfillmentLineItem[];
  deliveries: Array<{ delivery_id: number; delivery_number: string }>;
  source_pos: Array<{ po_id: number; po_number: string }>;
}

/** Purchase Order record. */
export interface PurchaseOrder {
  id: number;
  po_number: string;
  customer_id: string;
  customer_name?: string;
  start_date?: string;
  expiration_date?: string;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  google_doc_url?: string;
  hubspot_url?: string;
  line_items: POLineItem[];
  fulfillment_status?: POFulfillmentStatus;
  created_at?: string;
  created_by_user_id?: string;
  closed_at?: string;
  closed_by_user_id?: string;
}

/** A line item on an Order. */
export interface OrderLineItem {
  id?: number;
  item: number;
  item_name?: string;
  item_version?: string;
  quantity: number;
  price_per_unit?: string;
  po_line_item?: number;
  po_number?: string;
  notes?: string;
  override_reason?: string;
}

/** Order record. */
export interface Order {
  id: number;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  line_items: OrderLineItem[];
  fulfillment_status?: OrderFulfillmentStatus;
  created_at?: string;
  created_by_user_id?: string;
  closed_at?: string;
  closed_by_user_id?: string;
}

/** A line item on a Delivery (with serial number). */
export interface DeliveryLineItem {
  id?: number;
  item: number;
  item_name?: string;
  item_version?: string;
  serial_number: string;
  price_per_unit?: string;
  order_line_item?: number;
  order_number?: string;
  notes?: string;
  override_reason?: string;
}

/** Delivery record. */
export interface Delivery {
  id: number;
  delivery_number: string;
  customer_id: string;
  customer_name?: string;
  ship_date: string;
  tracking_number?: string;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  line_items: DeliveryLineItem[];
  created_at?: string;
  created_by_user_id?: string;
  closed_at?: string;
  closed_by_user_id?: string;
}

/** Response from waive endpoints. */
export interface WaiveResponse {
  detail?: string;
  message?: string;
}

/**
 * Field-level errors returned by DRF, keyed by field name.
 * Nested line-item errors use `line_items[0].field` keys.
 */
export type FieldErrors = Record<string, string>;

/** Parse DRF response into per-field error messages. */
export function getApiFieldErrors(err: unknown): FieldErrors {
  const data = getAxiosErrorData(err);
  if (!data) return {};
  const errors: FieldErrors = {};

  for (const [key, value] of Object.entries(data)) {
    if (key === 'detail' || key === 'error') continue;
    if (typeof value === 'string') {
      errors[key] = value;
    } else if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'string') {
        errors[key] = value[0] as string;
      } else {
        value.forEach((item: unknown, idx: number) => {
          if (typeof item === 'object' && item !== null) {
            for (const [nestedKey, nestedVal] of Object.entries(item as Record<string, unknown>)) {
              const msg = Array.isArray(nestedVal) ? String(nestedVal[0]) : String(nestedVal);
              errors[`${key}[${idx}].${nestedKey}`] = msg;
            }
          }
        });
      }
    }
  }
  return errors;
}

/** Extract error message from an unknown catch value (typically an Axios error). */
export function getFulfilErrorMessage(err: unknown, fallback: string): string {
  const data = getAxiosErrorData(err);
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.error === 'string') return data.error;
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      const label = key.replace(/_/g, ' ');
      if (typeof value === 'string') return `${label}: ${value}`;
      if (Array.isArray(value) && typeof value[0] === 'string') return `${label}: ${value[0]}`;
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

/** Check if an unknown error is an Axios 404 response. */
export function isNotFoundError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const resp = (err as { response?: { status?: number } }).response;
    return resp?.status === 404;
  }
  return false;
}
