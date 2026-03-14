"""
Management command to register FULFILinator with Authinator service registry.
"""
from django.core.management.base import BaseCommand
from django.conf import settings
import requests
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Register FULFILinator with Authinator service registry'

    def handle(self, *args, **options):
        """Register the service with Authinator."""
        
        service_data = {
            'name': 'FULFILinator',
            'description': 'Order Fulfillment Tracking',
            'base_url': 'http://localhost:8003',
            'api_prefix': '/api/fulfil',
            'ui_url': 'http://localhost:8080/fulfil',
            'ui_path': '/fulfil',
            'icon': '📦',
            'service_key': settings.SERVICE_REGISTRATION_KEY,
        }
        
        try:
            response = requests.post(
                settings.SERVICE_REGISTRY_URL,
                json=service_data,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully registered FULFILinator with Authinator')
                )
                logger.info('FULFILinator registered with Authinator')
            else:
                self.stdout.write(
                    self.style.ERROR(
                        f'Failed to register service: {response.status_code} - {response.text}'
                    )
                )
                logger.error(f'Failed to register FULFILinator: {response.text}')
                
        except requests.RequestException as e:
            self.stdout.write(
                self.style.ERROR(f'Error connecting to Authinator: {e}')
            )
            logger.error(f'Error registering FULFILinator: {e}')
