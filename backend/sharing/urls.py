from django.urls import path
from .views import (
    ShareGrantListCreateView,
    ShareGrantRevokeView,
    SharedWithMeListView,
    PublicShareMetadataView,
    PublicShareDownloadView,
)

app_name = 'sharing'

urlpatterns = [
    path('grants/', ShareGrantListCreateView.as_view(), name='share-grant-list-create'),
    path('grants/<uuid:pk>/revoke/', ShareGrantRevokeView.as_view(), name='share-grant-revoke'),
    path('shared-with-me/', SharedWithMeListView.as_view(), name='shared-with-me'),
    path('public/<str:token>/', PublicShareMetadataView.as_view(), name='public-share-metadata'),
    path('public/<str:token>/download/', PublicShareDownloadView.as_view(), name='public-share-download'),
]
