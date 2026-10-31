from django.urls import path
from .views import (
    DocumentListCreateView,
    DocumentDetailView,
    DocumentDownloadView,
    DocumentPreviewView,
    DocumentVersionListView,
    DocumentVersionDownloadView,
    DocumentVersionRestoreView,
    DocumentArchiveToggleView,
    DocumentTrashListView,
    DocumentRestoreView,
    DocumentPermanentDeleteView,
    CategoryListView,
    TagListView,
)

app_name = 'documents'

urlpatterns = [
    path('', DocumentListCreateView.as_view(), name='document-list-create'),
    path('categories/', CategoryListView.as_view(), name='category-list'),
    path('tags/', TagListView.as_view(), name='tag-list'),
    path('trash/', DocumentTrashListView.as_view(), name='document-trash-list'),
    path('<uuid:pk>/', DocumentDetailView.as_view(), name='document-detail'),
    path('<uuid:pk>/download/', DocumentDownloadView.as_view(), name='document-download'),
    path('<uuid:pk>/preview/', DocumentPreviewView.as_view(), name='document-preview'),
    path('<uuid:pk>/archive/', DocumentArchiveToggleView.as_view(), name='document-archive-toggle'),
    path('<uuid:pk>/restore/', DocumentRestoreView.as_view(), name='document-restore'),
    path('<uuid:pk>/permanent/', DocumentPermanentDeleteView.as_view(), name='document-permanent-delete'),
    path('<uuid:pk>/versions/', DocumentVersionListView.as_view(), name='document-versions'),
    path('<uuid:pk>/versions/<int:version_number>/download/', DocumentVersionDownloadView.as_view(), name='document-version-download'),
    path('<uuid:pk>/versions/<int:version_number>/restore/', DocumentVersionRestoreView.as_view(), name='document-version-restore'),
]
