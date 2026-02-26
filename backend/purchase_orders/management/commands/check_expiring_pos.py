"""
Django management command to check for expiring Purchase Orders.

This command is designed to be run as a scheduled job (e.g., daily cron).
It finds POs expiring within a specified threshold and sends email notifications.

Usage:
    python manage.py check_expiring_pos
    python manage.py check_expiring_pos --days 30
    python manage.py check_expiring_pos --days 7 --no-email
"""
from django.core.management.base import BaseCommand
from notifications.utils import check_expiring_pos


class Command(BaseCommand):
    help = 'Check for expiring Purchase Orders and send email notifications'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Number of days to look ahead (default: 30)'
        )
        parser.add_argument(
            '--no-email',
            action='store_true',
            help='Do not send email notifications, just report'
        )
    
    def handle(self, *args, **options):
        days_threshold = options['days']
        send_emails = not options['no_email']
        
        self.stdout.write(
            self.style.NOTICE(
                f'Checking for POs expiring within {days_threshold} days...'
            )
        )
        
        expiring_pos = check_expiring_pos(
            days_threshold=days_threshold,
            send_emails=send_emails
        )
        
        if expiring_pos:
            self.stdout.write(
                self.style.WARNING(
                    f'Found {len(expiring_pos)} expiring PO(s):'
                )
            )
            for item in expiring_pos:
                po = item['po']
                days = item['days_until_expiration']
                self.stdout.write(
                    f'  - PO {po.po_number} (Customer: {po.customer_id}) '
                    f'expires in {days} day(s)'
                )
            
            if send_emails:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Sent {len(expiring_pos)} email notification(s)'
                    )
                )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    'No expiring POs found.'
                )
            )
