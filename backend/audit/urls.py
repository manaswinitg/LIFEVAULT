from django.urls import path
from .views import AuditEventListView, AuditChainVerifyView

app_name = 'audit'

urlpatterns = [
    path('', AuditEventListView.as_view(), name='audit-event-list'),
    path('verify/', AuditChainVerifyView.as_view(), name='audit-chain-verify'),
]
