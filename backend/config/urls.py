"""
URL configuration for FULFILinator project.

Routes:
    /admin/ - Django admin interface
    /api/fulfil/ - FULFILinator API endpoints
    /api/fulfil/schema/ - OpenAPI schema
    /api/fulfil/docs/ - API documentation (Swagger UI)
    /api/fulfil/redoc/ - API documentation (ReDoc UI)
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from core.views import health_check, AttachmentViewSet, AdminOverrideViewSet
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
router.register(r'attachments', AttachmentViewSet, basename='attachment')
router.register(r'admin-overrides', AdminOverrideViewSet, basename='adminoverride')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/fulfil/health/', health_check, name='health-check'),
    path('api/fulfil/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/fulfil/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/fulfil/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    path('api/fulfil/dashboard/', include('dashboard.urls')),
    path('api/fulfil/', include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
