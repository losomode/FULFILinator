"""
URL configuration for FULFILinator project.

Routes:
    /admin/ - Django admin interface
    /api/fulfil/ - FULFILinator API endpoints
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import health_check
from items.views import ItemViewSet
from purchase_orders.views import PurchaseOrderViewSet
from orders.views import OrderViewSet
from deliveries.views import DeliveryViewSet

# API router
router = DefaultRouter()
router.register(r'items', ItemViewSet, basename='item')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchaseorder')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'deliveries', DeliveryViewSet, basename='delivery')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/fulfil/health/', health_check, name='health-check'),
    path('api/fulfil/', include(router.urls)),
]
