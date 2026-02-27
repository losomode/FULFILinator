/**
 * Tests for PODetail fulfillment status display
 * 
 * Following Deft TDD: Tests for fulfillment UI components
 * Target: ≥85% coverage
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PODetail from './PODetail';
import * as posApi from '../../api/pos';
import * as itemsApi from '../../api/items';

// Mock the API modules
vi.mock('../../api/pos');
vi.mock('../../api/items');

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
    useNavigate: () => vi.fn(),
  };
});

const mockPO = {
  id: 1,
  po_number: 'PO-20260226-0001',
  customer_id: 'cust-123',
  status: 'OPEN' as const,
  line_items: [
    {
      id: 1,
      item: 1,
      quantity: 10,
      price_per_unit: '899.99',
    },
  ],
  fulfillment_status: {
    line_items: [
      {
        line_item_id: 1,
        item_id: 1,
        item_name: 'Camera LR (v1.0)',
        original_quantity: 10,
        ordered_quantity: 3,
        remaining_quantity: 7,
        price_per_unit: '899.99',
      },
    ],
    orders: [
      {
        order_id: 1,
        order_number: 'ORD-20260226-0001',
      },
    ],
  },
  created_at: '2026-02-26T08:00:00Z',
};

const mockItems = [
  {
    id: 1,
    name: 'Camera LR',
    version: '1.0',
    msrp: '999.99',
    min_price: '799.99',
  },
];

describe('PODetail Fulfillment Status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(posApi.posApi.get).mockResolvedValue(mockPO);
    vi.mocked(itemsApi.itemsApi.list).mockResolvedValue(mockItems);
  });

  it('should display fulfillment status table', async () => {
    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Fulfillment Status')).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByText('Original Qty')).toBeInTheDocument();
    expect(screen.getByText('Ordered Qty')).toBeInTheDocument();
    expect(screen.getByText('Remaining Qty')).toBeInTheDocument();

    // Check fulfillment data
    expect(screen.getByText('Camera LR (v1.0)')).toBeInTheDocument();
    // Multiple tables exist, just verify the fulfillment section exists with correct data
    const fulfillmentSection = screen.getByText('Fulfillment Status').closest('div');
    expect(fulfillmentSection).toHaveTextContent('Camera LR (v1.0)');
    expect(fulfillmentSection).toHaveTextContent('Original Qty');
    expect(fulfillmentSection).toHaveTextContent('Ordered Qty');
    expect(fulfillmentSection).toHaveTextContent('Remaining Qty');
  });

  it('should display status badge for partially ordered items', async () => {
    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('30% Ordered')).toBeInTheDocument();
    });
  });

  it('should display linked orders', async () => {
    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Orders Fulfilled from this PO')).toBeInTheDocument();
    });

    const orderLink = screen.getByText('ORD-20260226-0001');
    expect(orderLink).toBeInTheDocument();
    expect(orderLink).toHaveAttribute('href', '/orders/1');
  });

  it('should display message when no orders exist', async () => {
    const poWithoutOrders = {
      ...mockPO,
      fulfillment_status: {
        line_items: [
          {
            line_item_id: 1,
            item_id: 1,
            item_name: 'Camera LR (v1.0)',
            original_quantity: 10,
            ordered_quantity: 0,
            remaining_quantity: 10,
            price_per_unit: '899.99',
          },
        ],
        orders: [],
      },
    };

    vi.mocked(posApi.posApi.get).mockResolvedValue(poWithoutOrders);

    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      const heading = screen.getByText('Fulfillment Status');
      expect(heading).toBeInTheDocument();
    });
    
    // Should NOT show orders section
    expect(screen.queryByText('Orders Fulfilled from this PO')).not.toBeInTheDocument();
  });

  it('should display "Complete" badge when remaining is zero', async () => {
    const fullyOrderedPO = {
      ...mockPO,
      fulfillment_status: {
        line_items: [
          {
            line_item_id: 1,
            item_id: 1,
            item_name: 'Camera LR (v1.0)',
            original_quantity: 10,
            ordered_quantity: 10,
            remaining_quantity: 0,
            price_per_unit: '899.99',
          },
        ],
        orders: [{ order_id: 1, order_number: 'ORD-20260226-0001' }],
      },
    };

    vi.mocked(posApi.posApi.get).mockResolvedValue(fullyOrderedPO);

    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });
  });

  it('should display "Not Started" badge when no items ordered', async () => {
    const notStartedPO = {
      ...mockPO,
      fulfillment_status: {
        line_items: [
          {
            line_item_id: 1,
            item_id: 1,
            item_name: 'Camera LR (v1.0)',
            original_quantity: 10,
            ordered_quantity: 0,
            remaining_quantity: 10,
            price_per_unit: '899.99',
          },
        ],
        orders: [],
      },
    };

    vi.mocked(posApi.posApi.get).mockResolvedValue(notStartedPO);

    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Not Started')).toBeInTheDocument();
    });
  });

  it('should handle close PO', async () => {
    const closedPO = { ...mockPO, status: 'CLOSED' as const };
    vi.mocked(posApi.posApi.close).mockResolvedValue(closedPO);

    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Close PO')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Close PO'));
    await waitFor(() => expect(posApi.posApi.close).toHaveBeenCalledWith(1));
  });

  it('should handle close PO error', async () => {
    vi.mocked(posApi.posApi.close).mockRejectedValue({
      response: { data: { error: 'Cannot close' } },
    });

    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Close PO')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Close PO'));
    await waitFor(() => expect(screen.getByText('Cannot close')).toBeInTheDocument());
  });

  it('should open waive modal and submit', async () => {
    vi.mocked(posApi.posApi.waive).mockResolvedValue({ detail: 'ok' });
    vi.mocked(posApi.posApi.get).mockResolvedValue(mockPO);

    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Waive')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Waive'));
    await waitFor(() => {
      expect(screen.getByText('Waive Remaining Quantity')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Waive Quantity'));
    await waitFor(() => expect(posApi.posApi.waive).toHaveBeenCalledWith(1, 1, 7, ''));
  });

  it('should show waive modal cancel', async () => {
    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Waive')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Waive'));
    await waitFor(() => {
      expect(screen.getByText('Waive Remaining Quantity')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Waive Remaining Quantity')).not.toBeInTheDocument();
  });

  it('should show waive validation error for zero quantity', async () => {
    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Waive')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Waive'));
    await waitFor(() => {
      expect(screen.getByText('Waive Remaining Quantity')).toBeInTheDocument();
    });

    // Set quantity to 0
    const qtyInput = screen.getByDisplayValue('7');
    fireEvent.change(qtyInput, { target: { value: '0' } });
    fireEvent.click(screen.getByText('Waive Quantity'));

    await waitFor(() => {
      expect(screen.getByText('Quantity must be positive')).toBeInTheDocument();
    });
  });

  it('should show waive API error', async () => {
    vi.mocked(posApi.posApi.waive).mockRejectedValue(new Error('waive fail'));

    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Waive')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Waive'));
    await waitFor(() => {
      expect(screen.getByText('Waive Remaining Quantity')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Waive Quantity'));
    await waitFor(() => {
      expect(screen.getByText('waive fail')).toBeInTheDocument();
    });
  });

  it('should show load error', async () => {
    vi.mocked(posApi.posApi.get).mockRejectedValue(new Error('load fail'));

    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PO not found')).toBeInTheDocument();
    });
  });

  it('should display no fulfillment message when empty', async () => {
    const noFulfillmentPO = {
      ...mockPO,
      fulfillment_status: { line_items: [], orders: [] },
    };
    vi.mocked(posApi.posApi.get).mockResolvedValue(noFulfillmentPO);

    render(
      <BrowserRouter>
        <PODetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No orders have been created/)).toBeInTheDocument();
    });
  });
});
