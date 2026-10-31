from django.urls import path
from .views import (
    TrustedContactListCreateView,
    TrustedContactDeleteView,
    EmergencyPolicyListCreateView,
    EmergencyRequestInitiateView,
    EmergencyRequestCancelView,
    EmergencyRequestApproveView,
    EmergencyRequestStatusView,
    EmergencyGrantedDocumentsView,
)

app_name = 'emergency_access'

urlpatterns = [
    path('contacts/', TrustedContactListCreateView.as_view(), name='contact-list-create'),
    path('contacts/<uuid:pk>/', TrustedContactDeleteView.as_view(), name='contact-delete'),
    path('policies/', EmergencyPolicyListCreateView.as_view(), name='policy-list-create'),
    path('requests/initiate/', EmergencyRequestInitiateView.as_view(), name='request-initiate'),
    path('requests/<uuid:pk>/cancel/', EmergencyRequestCancelView.as_view(), name='request-cancel'),
    path('requests/<uuid:pk>/approve/', EmergencyRequestApproveView.as_view(), name='request-approve'),
    path('requests/<uuid:pk>/status/', EmergencyRequestStatusView.as_view(), name='request-status'),
    path('requests/<uuid:pk>/documents/', EmergencyGrantedDocumentsView.as_view(), name='request-documents'),
]
