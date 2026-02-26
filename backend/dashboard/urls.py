"""
URL configuration for dashboard app.
"""
from django.urls import path
from dashboard import views

urlpatterns = [
    path('metrics/', views.metrics, name='dashboard-metrics'),
    path('alerts/', views.alerts, name='dashboard-alerts'),
]
