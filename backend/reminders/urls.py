from django.urls import path
from .views import (
    UpcomingExpirationsListView,
    ReminderListCreateView,
    ReminderResolveView,
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
)

app_name = 'reminders'

urlpatterns = [
    path('', ReminderListCreateView.as_view(), name='reminder-list-create'),
    path('upcoming/', UpcomingExpirationsListView.as_view(), name='upcoming-expirations'),
    path('<uuid:pk>/resolve/', ReminderResolveView.as_view(), name='reminder-resolve'),
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/<uuid:pk>/read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('notifications/read-all/', NotificationMarkAllReadView.as_view(), name='notification-mark-all-read'),
]
