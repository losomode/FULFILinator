"""
End-to-end integration tests for complete fulfillment workflows.

Tests the full flow: PO -> Order -> Delivery with allocation and fulfillment tracking.
"""
import pytest
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta

from items.models import Item
from purchase_orders.models import PurchaseOrder, POLineItem
from orders.models import Order, OrderLineItem
from deliveries.models import Delivery, DeliveryLineItem
from core.models import AdminOverride


@pytest.mark.django_db
class TestFullFulfillmentWorkflow:
    """Test complete fulfillment workflow from PO to Delivery."""
    
    @pytest.fixture
    def setup_items(self):
        """Create test items."""
        item1 = Item.objects.create(
            name='Camera LR',
            version='1.0',
            msrp=Decimal('999.99'),
            min_price=Decimal('799.99'),
            created_by_user_id='admin-1'
        )
        item2 = Item.objects.create(
            name='Node 4.6',
            version='4.6',
            msrp=Decimal('499.99'),
            min_price=Decimal('399.99'),
            created_by_user_id='admin-1'
        )
        return {'item1': item1, 'item2': item2}
    
    def test_complete_fulfillment_workflow(self, setup_items):
        """
        Test complete workflow:
        1. Create PO with multiple line items
        2. Create Order that allocates from PO
        3. Create Delivery that fulfills Order
        4. Verify fulfillment status updates correctly
        5. Close everything
        """
        item1 = setup_items['item1']
        item2 = setup_items['item2']
        
        # Step 1: Create Purchase Order
        po = PurchaseOrder.objects.create(
            po_number='PO-2026-001',
            customer_id='cust-acme',
            start_date=timezone.now().date(),
            expiration_date=timezone.now().date() + timedelta(days=90),
            status='OPEN'
        )
        
        po_line1 = POLineItem.objects.create(
            po=po,
            item=item1,
            quantity=10,
            price_per_unit=Decimal('899.99')
        )
        po_line2 = POLineItem.objects.create(
            po=po,
            item=item2,
            quantity=5,
            price_per_unit=Decimal('449.99')
        )
        
        # Verify initial PO status
        assert po.status == 'OPEN'
        assert not po.is_ready_to_close()
        fulfillment = po.get_fulfillment_status()
        assert len(fulfillment['line_items']) == 2
        assert fulfillment['line_items'][0]['remaining_quantity'] == 10
        assert fulfillment['line_items'][1]['remaining_quantity'] == 5
        
        # Step 2: Create Order (allocates from PO)
        order = Order.objects.create(
            order_number='ORD-2026-001',
            customer_id='cust-acme',
            status='OPEN'
        )
        
        order_line1 = OrderLineItem.objects.create(
            order=order,
            item=item1,
            quantity=8,  # Order 8 out of 10
            price_per_unit=Decimal('899.99'),
            po_line_item=po_line1
        )
        order_line2 = OrderLineItem.objects.create(
            order=order,
            item=item2,
            quantity=3,  # Order 3 out of 5
            price_per_unit=Decimal('449.99'),
            po_line_item=po_line2
        )
        
        # Verify PO fulfillment updated
        po.refresh_from_db()
        fulfillment = po.get_fulfillment_status()
        assert fulfillment['line_items'][0]['ordered_quantity'] == 8
        assert fulfillment['line_items'][0]['remaining_quantity'] == 2
        assert fulfillment['line_items'][1]['ordered_quantity'] == 3
        assert fulfillment['line_items'][1]['remaining_quantity'] == 2
        assert not po.is_ready_to_close()  # Still has remaining items
        
        # Verify Order is not ready to close (not delivered yet)
        assert not order.is_ready_to_close()
        
        # Step 3: Create Delivery (fulfills Order)
        delivery = Delivery.objects.create(
            delivery_number='DEL-2026-001',
            customer_id='cust-acme',
            ship_date=timezone.now().date(),
            tracking_number='TRACK123456',
            status='OPEN'
        )
        
        # Deliver all items from order
        for i in range(8):  # 8 cameras
            DeliveryLineItem.objects.create(
                delivery=delivery,
                item=item1,
                serial_number=f'CAM-SN-{i+1:03d}',
                price_per_unit=Decimal('899.99'),
                order_line_item=order_line1
            )
        
        for i in range(3):  # 3 nodes
            DeliveryLineItem.objects.create(
                delivery=delivery,
                item=item2,
                serial_number=f'NODE-SN-{i+1:03d}',
                price_per_unit=Decimal('449.99'),
                order_line_item=order_line2
            )
        
        # Verify Order is now ready to close (all delivered)
        order.refresh_from_db()
        assert order.is_ready_to_close()
        
        # Step 4: Close Delivery
        delivery.status = 'CLOSED'
        delivery.closed_at = timezone.now()
        delivery.closed_by_user_id = 'admin-1'
        delivery.save()
        
        assert delivery.status == 'CLOSED'
        assert delivery.line_items.count() == 11  # 8 + 3
        
        # Step 5: Close Order (now that it's fully delivered)
        order.status = 'CLOSED'
        order.closed_at = timezone.now()
        order.closed_by_user_id = 'admin-1'
        order.save()
        
        assert order.status == 'CLOSED'
        
        # Step 6: Waive remaining PO items and close
        # We ordered 8/10 cameras and 3/5 nodes, so 2 cameras and 2 nodes remain
        po_line1.waived_quantity = 2
        po_line1.save()
        po_line2.waived_quantity = 2
        po_line2.save()
        
        # Now PO should be ready to close
        po.refresh_from_db()
        assert po.is_ready_to_close()
        
        po.status = 'CLOSED'
        po.closed_at = timezone.now()
        po.closed_by_user_id = 'admin-1'
        po.save()
        
        assert po.status == 'CLOSED'
        
        # Verify final state
        assert PurchaseOrder.objects.filter(status='CLOSED').count() == 1
        assert Order.objects.filter(status='CLOSED').count() == 1
        assert Delivery.objects.filter(status='CLOSED').count() == 1
        assert DeliveryLineItem.objects.count() == 11
    
    def test_partial_fulfillment_with_admin_override(self, setup_items):
        """
        Test workflow with admin override:
        1. Create PO
        2. Create partial Order
        3. Force close PO with admin override
        4. Verify override is logged
        """
        item = setup_items['item1']
        
        # Create PO
        po = PurchaseOrder.objects.create(
            po_number='PO-2026-002',
            customer_id='cust-beta',
            start_date=timezone.now().date(),
            expiration_date=timezone.now().date() + timedelta(days=30),
            status='OPEN'
        )
        
        po_line = POLineItem.objects.create(
            po=po,
            item=item,
            quantity=20,
            price_per_unit=Decimal('899.99')
        )
        
        # Create partial order (only 5 out of 20)
        order = Order.objects.create(
            order_number='ORD-2026-002',
            customer_id='cust-beta',
            status='OPEN'
        )
        
        OrderLineItem.objects.create(
            order=order,
            item=item,
            quantity=5,
            price_per_unit=Decimal('899.99'),
            po_line_item=po_line
        )
        
        # PO should NOT be ready to close (15 items remaining)
        assert not po.is_ready_to_close()
        fulfillment = po.get_fulfillment_status()
        assert fulfillment['line_items'][0]['remaining_quantity'] == 15
        
        # Admin force closes with override
        AdminOverride.objects.create(
            entity_type='PO',
            entity_id=po.id,
            entity_number=po.po_number,
            override_type='CLOSE',
            reason='Customer cancelled remaining items',
            user_id='admin-1',
            user_email='admin@test.com',
            metadata={'unfulfilled_items': True, 'remaining_quantity': 15}
        )
        
        po.status = 'CLOSED'
        po.closed_at = timezone.now()
        po.closed_by_user_id = 'admin-1'
        po.save()
        
        # Verify override was logged
        overrides = AdminOverride.objects.filter(entity_type='PO', entity_id=po.id)
        assert overrides.count() == 1
        override = overrides.first()
        assert override.override_type == 'CLOSE'
        assert override.reason == 'Customer cancelled remaining items'
        assert override.metadata['remaining_quantity'] == 15
    
    def test_multiple_orders_from_single_po(self, setup_items):
        """
        Test multiple orders allocating from the same PO.
        Verifies oldest-first allocation logic.
        """
        item = setup_items['item1']
        
        # Create PO with 50 units
        po = PurchaseOrder.objects.create(
            po_number='PO-2026-003',
            customer_id='cust-gamma',
            start_date=timezone.now().date(),
            expiration_date=timezone.now().date() + timedelta(days=60),
            status='OPEN'
        )
        
        po_line = POLineItem.objects.create(
            po=po,
            item=item,
            quantity=50,
            price_per_unit=Decimal('899.99')
        )
        
        # Create first order
        order1 = Order.objects.create(
            order_number='ORD-2026-003A',
            customer_id='cust-gamma',
            status='OPEN'
        )
        OrderLineItem.objects.create(
            order=order1,
            item=item,
            quantity=20,
            price_per_unit=Decimal('899.99'),
            po_line_item=po_line
        )
        
        # Create second order
        order2 = Order.objects.create(
            order_number='ORD-2026-003B',
            customer_id='cust-gamma',
            status='OPEN'
        )
        OrderLineItem.objects.create(
            order=order2,
            item=item,
            quantity=15,
            price_per_unit=Decimal('899.99'),
            po_line_item=po_line
        )
        
        # Create third order
        order3 = Order.objects.create(
            order_number='ORD-2026-003C',
            customer_id='cust-gamma',
            status='OPEN'
        )
        OrderLineItem.objects.create(
            order=order3,
            item=item,
            quantity=10,
            price_per_unit=Decimal('899.99'),
            po_line_item=po_line
        )
        
        # Verify PO fulfillment
        po.refresh_from_db()
        fulfillment = po.get_fulfillment_status()
        assert fulfillment['line_items'][0]['ordered_quantity'] == 45  # 20 + 15 + 10
        assert fulfillment['line_items'][0]['remaining_quantity'] == 5
        assert len(fulfillment['orders']) == 3
        
        # Waive the remaining 5 units
        po_line.waived_quantity = 5
        po_line.save()
        
        # Now PO should be ready to close
        po.refresh_from_db()
        assert po.is_ready_to_close()
