from django.urls import path, include
from .views import HealthCheckView, DashboardSummaryView

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('auth/', include('accounts.urls')),
    path('documents/', include('documents.urls')),
    path('reminders/', include('reminders.urls')),
    path('sharing/', include('sharing.urls')),
    path('emergency/', include('emergency_access.urls')),
    path('audit/', include('audit.urls')),
]
