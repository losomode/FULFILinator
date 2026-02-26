"""
Email notification utilities for FULFILinator.

Provides functions to send emails for key events:
- Delivery shipped (to customers)
- PO/Order ready to close (to admins)
- PO expiring soon (to admins)
"""
from django.core.mail import send_mail
from django.conf import settings
from core.authinator_client import authinator_client
import logging

logger = logging.getLogger(__name__)


def get_admin_emails():
    """
    Get list of admin email addresses from Authinator.
    
    Note: This makes an API call to Authinator. For production,
    consider caching this or getting it from a local config.
    
    Returns:
        list: List of admin email addresses
    """
    # TODO: Implement API endpoint in Authinator to fetch admin emails
    # For now, return a placeholder or configure via settings
    admin_emails = getattr(settings, 'ADMIN_NOTIFICATION_EMAILS', [])
    
    if not admin_emails:
        logger.warning('No admin emails configured. Set ADMIN_NOTIFICATION_EMAILS in settings.')
    
    return admin_emails


def get_customer_email(customer_id):
    """
    Get customer contact email from Authinator.
    
    Args:
        customer_id (str): Customer ID
    
    Returns:
        str: Customer contact email or None
    """
    if not customer_id:
        return None
    
    customer = authinator_client.get_customer(customer_id)
    if customer:
        return customer.get('contact_email') or customer.get('email')
    
    return None


def send_delivery_shipped_email(delivery):
    """
    Send email to customer when a delivery is shipped/closed.
    
    Args:
        delivery: Delivery instance
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    customer_email = get_customer_email(delivery.customer_id)
    if not customer_email:
        logger.warning(f'No email found for customer {delivery.customer_id}')
        return False
    
    # Get line items with serial numbers
    line_items_text = []
    for line_item in delivery.line_items.all():
        line_items_text.append(
            f"  - {line_item.item.name}\n"
            f"    Serial Number: {line_item.serial_number}"
        )
    
    subject = f'Delivery Shipped: #{delivery.delivery_number}'
    
    message = f"""
Hello,

Your delivery #{delivery.delivery_number} has been shipped.

Ship Date: {delivery.ship_date.strftime('%Y-%m-%d') if delivery.ship_date else 'Not set'}
Tracking Number: {delivery.tracking_number or 'N/A'}

Items Shipped:
{chr(10).join(line_items_text)}

Thank you for your business,
FULFILinator Team
"""
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[customer_email],
            fail_silently=False,
        )
        logger.info(f'Sent delivery shipped email for {delivery.delivery_number} to {customer_email}')
        return True
    except Exception as e:
        logger.error(f'Failed to send delivery shipped email: {e}')
        return False


def send_po_expiring_soon_email(po, days_until_expiration):
    """
    Send email to admins when a PO is expiring soon.
    
    Args:
        po: PurchaseOrder instance
        days_until_expiration (int): Number of days until expiration
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    admin_emails = get_admin_emails()
    if not admin_emails:
        return False
    
    fulfillment_status = po.get_fulfillment_status()
    total_items = len(fulfillment_status['line_items'])
    fulfilled_items = sum(1 for item in fulfillment_status['line_items'] if item['remaining_quantity'] == 0)
    
    subject = f'PO Expiring Soon: {po.po_number} ({days_until_expiration} days)'
    
    message = f"""
PURCHASE ORDER EXPIRATION ALERT

A Purchase Order is expiring soon and may require action.

PO Number: {po.po_number}
Customer ID: {po.customer_id}
Expiration Date: {po.expiration_date.strftime('%Y-%m-%d')}
Days Until Expiration: {days_until_expiration}

Fulfillment Status:
- Line Items: {fulfilled_items}/{total_items} fulfilled

{'This PO is ready to close.' if po.is_ready_to_close() else 'This PO has unfulfilled items.'}

Please review and take appropriate action.

Thank you,
FULFILinator System
"""
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=admin_emails,
            fail_silently=False,
        )
        logger.info(f'Sent PO expiring soon email for {po.po_number}')
        return True
    except Exception as e:
        logger.error(f'Failed to send PO expiring soon email: {e}')
        return False


def send_po_ready_to_close_email(po):
    """
    Send email to admins when a PO becomes ready to close.
    
    Args:
        po: PurchaseOrder instance
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    admin_emails = get_admin_emails()
    if not admin_emails:
        return False
    
    subject = f'PO Ready to Close: {po.po_number}'
    
    message = f"""
PURCHASE ORDER READY TO CLOSE

A Purchase Order is now ready to be closed.

PO Number: {po.po_number}
Customer ID: {po.customer_id}
Expiration Date: {po.expiration_date.strftime('%Y-%m-%d') if po.expiration_date else 'Not set'}

All line items have been fulfilled or waived. You may now close this PO.

Thank you,
FULFILinator System
"""
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=admin_emails,
            fail_silently=False,
        )
        logger.info(f'Sent PO ready to close email for {po.po_number}')
        return True
    except Exception as e:
        logger.error(f'Failed to send PO ready to close email: {e}')
        return False


def send_order_ready_to_close_email(order):
    """
    Send email to admins when an Order becomes ready to close.
    
    Args:
        order: Order instance
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    admin_emails = get_admin_emails()
    if not admin_emails:
        return False
    
    subject = f'Order Ready to Close: {order.order_number}'
    
    message = f"""
ORDER READY TO CLOSE

An Order is now ready to be closed.

Order Number: {order.order_number}
Customer ID: {order.customer_id}
Created: {order.created_at.strftime('%Y-%m-%d')}

All line items have been fulfilled or waived. You may now close this Order.

Thank you,
FULFILinator System
"""
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=admin_emails,
            fail_silently=False,
        )
        logger.info(f'Sent Order ready to close email for {order.order_number}')
        return True
    except Exception as e:
        logger.error(f'Failed to send Order ready to close email: {e}')
        return False


def check_expiring_pos(days_threshold=30, send_emails=True):
    """
    Check for POs expiring within the specified threshold and optionally send notifications.
    
    This function is designed to be run as a scheduled job (e.g., daily cron).
    
    Args:
        days_threshold (int): Number of days to look ahead (default: 30)
        send_emails (bool): Whether to send email notifications (default: True)
    
    Returns:
        list: List of dicts with expiring PO info: [{'po': PO, 'days_until_expiration': int}]
    """
    from django.utils import timezone
    from datetime import timedelta
    from purchase_orders.models import PurchaseOrder
    
    today = timezone.now().date()
    threshold_date = today + timedelta(days=days_threshold)
    
    # Find open POs expiring within threshold
    expiring_pos = PurchaseOrder.objects.filter(
        status='OPEN',
        expiration_date__lte=threshold_date,
        expiration_date__gte=today
    )
    
    results = []
    for po in expiring_pos:
        days_until_expiration = (po.expiration_date - today).days
        results.append({
            'po': po,
            'days_until_expiration': days_until_expiration
        })
        
        if send_emails:
            send_po_expiring_soon_email(po, days_until_expiration)
    
    logger.info(f'Found {len(results)} POs expiring within {days_threshold} days')
    return results
