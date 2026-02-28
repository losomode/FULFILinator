"""
Management command to populate Fulfilinator with demo data.

Creates items, purchase orders, orders, and deliveries with realistic
cross-references and backdated timestamps. Customer/user IDs must match
Authinator's demo data (created by Authinator seed_demo).

Idempotent — safe to run multiple times.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from items.models import Item
from purchase_orders.models import PurchaseOrder, POLineItem
from orders.models import Order, OrderLineItem
from deliveries.models import Delivery, DeliveryLineItem


# ── Authinator ID mapping (must match Authinator seed_demo output) ───
# Customer IDs: 1=Platform Admin, 2=Meridian, 3=Apex, 4=Coastal
# User IDs: 1=admin, 2=sarah.chen, 3=james.wilson, 4=lisa.patel,
#            5=mike.torres, 6=emma.jackson
MERIDIAN_CID = '2'
APEX_CID = '3'
COASTAL_CID = '4'
ADMIN_UID = '1'

# Relative dates (days before "today")
TODAY = date.today()


def days_ago(n):
    return TODAY - timedelta(days=n)


def dt_days_ago(n):
    return timezone.now() - timedelta(days=n)


class Command(BaseCommand):
    help = 'Populate Fulfilinator with demo items, POs, orders, and deliveries'

    def handle(self, *args, **options):
        self.stdout.write('Seeding Fulfilinator demo data...')
        items = self._create_items()
        po_lines = self._create_pos(items)
        order_lines = self._create_orders(items, po_lines)
        self._create_deliveries(items, order_lines)
        self.stdout.write(self.style.SUCCESS('✓ Fulfilinator demo data seeded'))

    # ── Items ────────────────────────────────────────────────────────
    def _create_items(self):
        specs = [
            ('Camera LR', '2.0', 'Long-range surveillance camera with IR night vision',
             Decimal('1299.00'), Decimal('999.00')),
            ('Camera SR', '1.5', 'Short-range wide-angle camera for indoor monitoring',
             Decimal('799.00'), Decimal('599.00')),
            ('Node', '4.6', 'Edge processing node for real-time analytics',
             Decimal('2499.00'), Decimal('1999.00')),
            ('Node', '4.6 GA', 'General availability edge node with extended support',
             Decimal('2299.00'), Decimal('1799.00')),
            ('Mounting Kit Pro', '', 'Universal pole/wall mount with weatherproof housing',
             Decimal('149.00'), Decimal('99.00')),
            ('License Dongle', '', 'USB hardware license key for offline activation',
             Decimal('49.00'), Decimal('39.00')),
        ]
        items = {}
        for name, version, desc, msrp, min_price in specs:
            key = f'{name} {version}'.strip()
            item, created = Item.objects.get_or_create(
                name=name, version=version,
                defaults={
                    'description': desc, 'msrp': msrp, 'min_price': min_price,
                    'created_by_user_id': ADMIN_UID,
                },
            )
            items[key] = item
            if created:
                Item.objects.filter(pk=item.pk).update(created_at=dt_days_ago(180))
            self._log('Item', key, created)
        return items

    # ── Purchase Orders ──────────────────────────────────────────────
    def _create_pos(self, items):
        po_specs = [
            ('PO-20250115-0001', MERIDIAN_CID, days_ago(70), days_ago(70) + timedelta(days=180),
             'Initial camera and node deployment',
             [('Camera LR 2.0', 20, Decimal('1099.00')),
              ('Node 4.6', 10, Decimal('2099.00')),
              ('Mounting Kit Pro', 5, Decimal('129.00'))]),
            ('PO-20250201-0001', APEX_CID, days_ago(27), days_ago(27) + timedelta(days=120),
             'Factory floor monitoring expansion',
             [('Camera SR 1.5', 50, Decimal('649.00')),
              ('Node 4.6 GA', 25, Decimal('1899.00'))]),
            ('PO-20250215-0001', COASTAL_CID, days_ago(13), days_ago(13) + timedelta(days=90),
             'Branch office security upgrade',
             [('Camera LR 2.0', 15, Decimal('1149.00')),
              ('Camera SR 1.5', 15, Decimal('699.00')),
              ('Node 4.6', 10, Decimal('2199.00'))]),
        ]
        po_lines = {}
        for po_num, cid, start, expire, notes, line_specs in po_specs:
            po, created = PurchaseOrder.objects.get_or_create(
                po_number=po_num,
                defaults={
                    'customer_id': cid, 'start_date': start,
                    'expiration_date': expire, 'status': 'OPEN',
                    'notes': notes, 'created_by_user_id': ADMIN_UID,
                },
            )
            if created:
                PurchaseOrder.objects.filter(pk=po.pk).update(created_at=dt_days_ago((TODAY - start).days))
            self._log('PO', po_num, created)
            for item_key, qty, price in line_specs:
                li, li_created = POLineItem.objects.get_or_create(
                    po=po, item=items[item_key],
                    defaults={'quantity': qty, 'price_per_unit': price},
                )
                key = f'{po_num}:{item_key}'
                po_lines[key] = li
        return po_lines

    # ── Orders ───────────────────────────────────────────────────────
    def _create_orders(self, items, po_lines):
        order_specs = [
            # (order_num, customer_id, notes, status, days_ago, line_items)
            # line_items: (item_key, qty, price, po_line_key_or_None)
            ('ORD-20250120-0001', MERIDIAN_CID, 'Phase 1 deployment', 'OPEN', 65,
             [('Camera LR 2.0', 10, Decimal('1099.00'), 'PO-20250115-0001:Camera LR 2.0'),
              ('Node 4.6', 5, Decimal('2099.00'), 'PO-20250115-0001:Node 4.6')]),
            ('ORD-20250125-0001', MERIDIAN_CID, 'Mounting hardware for phase 1', 'CLOSED', 60,
             [('Mounting Kit Pro', 3, Decimal('129.00'), 'PO-20250115-0001:Mounting Kit Pro')]),
            ('ORD-20250205-0001', APEX_CID, 'Factory floor cameras batch 1', 'OPEN', 23,
             [('Camera SR 1.5', 20, Decimal('649.00'), 'PO-20250201-0001:Camera SR 1.5'),
              ('Node 4.6 GA', 10, Decimal('1899.00'), 'PO-20250201-0001:Node 4.6 GA')]),
            ('ORD-20250220-0001', COASTAL_CID, 'Initial branch rollout', 'OPEN', 8,
             [('Camera LR 2.0', 5, Decimal('1149.00'), 'PO-20250215-0001:Camera LR 2.0'),
              ('Camera SR 1.5', 5, Decimal('699.00'), 'PO-20250215-0001:Camera SR 1.5')]),
            ('ORD-20250225-0001', APEX_CID, 'Ad-hoc license key request', 'OPEN', 3,
             [('License Dongle', 5, Decimal('45.00'), None)]),
        ]
        order_lines = {}
        for ord_num, cid, notes, status, ago, line_specs in order_specs:
            order, created = Order.objects.get_or_create(
                order_number=ord_num,
                defaults={
                    'customer_id': cid, 'status': status, 'notes': notes,
                    'created_by_user_id': ADMIN_UID,
                },
            )
            if created:
                updates = {'created_at': dt_days_ago(ago)}
                if status == 'CLOSED':
                    updates['closed_at'] = dt_days_ago(ago - 5)
                    updates['closed_by_user_id'] = ADMIN_UID
                Order.objects.filter(pk=order.pk).update(**updates)
            self._log('Order', ord_num, created)
            for item_key, qty, price, po_line_key in line_specs:
                po_li = po_lines.get(po_line_key) if po_line_key else None
                li, _ = OrderLineItem.objects.get_or_create(
                    order=order, item=items[item_key],
                    defaults={
                        'quantity': qty, 'price_per_unit': price,
                        'po_line_item': po_li,
                    },
                )
                key = f'{ord_num}:{item_key}'
                order_lines[key] = li
        return order_lines

    # ── Deliveries ───────────────────────────────────────────────────
    def _create_deliveries(self, items, order_lines):
        delivery_specs = [
            ('DEL-20250201-0001', MERIDIAN_CID, days_ago(27), '1Z999AA10123456784', 'CLOSED', 27,
             [('Camera LR 2.0', 'CLR-M', 1, 6, 'ORD-20250120-0001:Camera LR 2.0'),
              ('Node 4.6', 'N46-M', 1, 3, 'ORD-20250120-0001:Node 4.6')]),
            ('DEL-20250210-0001', MERIDIAN_CID, days_ago(18), '1Z999AA10123456785', 'CLOSED', 18,
             [('Mounting Kit Pro', 'MKP-M', 1, 3, 'ORD-20250125-0001:Mounting Kit Pro')]),
            ('DEL-20250210-0002', APEX_CID, days_ago(18), '1Z999AA10234567891', 'CLOSED', 18,
             [('Camera SR 1.5', 'CSR-A', 1, 10, 'ORD-20250205-0001:Camera SR 1.5'),
              ('Node 4.6 GA', 'NGA-A', 1, 5, 'ORD-20250205-0001:Node 4.6 GA')]),
            ('DEL-20250220-0001', APEX_CID, days_ago(8), '1Z999AA10234567892', 'OPEN', 8,
             [('Camera SR 1.5', 'CSR-A', 11, 15, 'ORD-20250205-0001:Camera SR 1.5')]),
        ]
        for del_num, cid, ship, tracking, status, ago, line_specs in delivery_specs:
            delivery, created = Delivery.objects.get_or_create(
                delivery_number=del_num,
                defaults={
                    'customer_id': cid, 'ship_date': ship,
                    'tracking_number': tracking, 'status': status,
                    'created_by_user_id': ADMIN_UID,
                },
            )
            if created:
                updates = {'created_at': dt_days_ago(ago)}
                if status == 'CLOSED':
                    updates['closed_at'] = dt_days_ago(ago - 2)
                    updates['closed_by_user_id'] = ADMIN_UID
                Delivery.objects.filter(pk=delivery.pk).update(**updates)
            self._log('Delivery', del_num, created)
            for item_key, sn_prefix, sn_start, sn_end, ol_key in line_specs:
                item = items[item_key]
                order_li = order_lines.get(ol_key)
                price = order_li.price_per_unit if order_li else item.msrp
                for i in range(sn_start, sn_end + 1):
                    sn = f'{sn_prefix}-{i:04d}'
                    DeliveryLineItem.objects.get_or_create(
                        serial_number=sn,
                        defaults={
                            'delivery': delivery, 'item': item,
                            'price_per_unit': price,
                            'order_line_item': order_li,
                        },
                    )

    def _log(self, kind, name, created):
        status = 'created' if created else 'exists'
        self.stdout.write(f'  {kind}: {name} ({status})')
