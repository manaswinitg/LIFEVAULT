import os
import time
from datetime import datetime, timezone, date, timedelta
from pathlib import Path
from django.conf import settings
from django.db import connection
from django.db.models import Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from drf_spectacular.utils import extend_schema

from documents.models import Document, DocumentCategory
from documents.serializers import DocumentListSerializer
from reminders.models import DocumentReminder, Notification
from sharing.models import ShareGrant
from audit.models import AuditEvent
from audit.serializers import AuditEventSerializer

class HealthCheckView(APIView):
    """
    Public health check endpoint for monitoring, load balancers, and container orchestrators.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        start_time = time.time()
        health_status = {
            "status": "healthy",
            "service": "LifeVault Secure Digital Document Vault",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": {
                "database": "unknown",
                "storage": "unknown"
            }
        }

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                row = cursor.fetchone()
                health_status["checks"]["database"] = "ok" if row and row[0] == 1 else "unexpected_response"
        except Exception as e:
            health_status["checks"]["database"] = f"error: {str(e)}"
            health_status["status"] = "degraded"

        try:
            storage_path = Path(settings.VAULT_STORAGE_ROOT)
            if not storage_path.exists():
                storage_path.mkdir(parents=True, exist_ok=True)
            test_file = storage_path / '.health_check.tmp'
            test_file.write_text('health_check', encoding='utf-8')
            test_file.unlink(missing_ok=True)
            health_status["checks"]["storage"] = "ok"
        except Exception as e:
            health_status["checks"]["storage"] = f"error: {str(e)}"
            health_status["status"] = "unhealthy"

        health_status["response_time_ms"] = round((time.time() - start_time) * 1000, 2)
        http_status = status.HTTP_200_OK if health_status["status"] == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(health_status, status=http_status)


class DashboardSummaryView(APIView):
    """
    Aggregates real-time vault analytics and metrics for the authenticated user dashboard.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = date.today()
        sixty_days_ahead = today + timedelta(days=60)
        now = datetime.now(timezone.utc)

        # 1. Document metrics
        active_docs = Document.objects.filter(owner=user, is_deleted=False)
        total_documents = active_docs.count()
        archived_count = active_docs.filter(is_archived=True).count()

        # 2. Storage metrics
        storage_used_bytes = user.profile.storage_used_bytes if hasattr(user, 'profile') else 0
        storage_limit_bytes = user.profile.storage_limit_bytes if hasattr(user, 'profile') else 104857600

        # 3. Category distribution
        categories = DocumentCategory.objects.all()
        category_distribution = []
        for cat in categories:
            cat_count = active_docs.filter(category=cat).count()
            if cat_count > 0:
                category_distribution.append({
                    "id": str(cat.id),
                    "name": cat.name,
                    "display_name": cat.display_name,
                    "icon": cat.icon,
                    "count": cat_count
                })

        # 4. Recently uploaded
        recent_docs = active_docs.order_by('-created_at')[:5]

        # 5. Upcoming expirations
        expiring_docs = active_docs.filter(
            expiry_date__isnull=False,
            expiry_date__gte=today,
            expiry_date__lte=sixty_days_ahead
        ).order_by('expiry_date')[:5]

        # 6. Active share links
        active_shares = ShareGrant.objects.filter(
            owner=user,
            is_revoked=False
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now)).select_related('document')
        active_shares_count = active_shares.count()

        # 7. Outstanding reminders
        unresolved_reminders_count = DocumentReminder.objects.filter(
            user=user,
            is_resolved=False,
            document__is_deleted=False
        ).count()

        # 8. Unread notifications count
        unread_notifications_count = Notification.objects.filter(user=user, is_read=False).count()

        # 9. Recent audit activity
        recent_audit_events = AuditEvent.objects.filter(actor=user).order_by('-timestamp')[:5]

        return Response({
            "total_documents": total_documents,
            "archived_count": archived_count,
            "storage_used_bytes": storage_used_bytes,
            "storage_limit_bytes": storage_limit_bytes,
            "category_distribution": category_distribution,
            "recent_documents": DocumentListSerializer(recent_docs, many=True).data,
            "upcoming_expirations": DocumentListSerializer(expiring_docs, many=True).data,
            "active_shares_count": active_shares_count,
            "unresolved_reminders_count": unresolved_reminders_count,
            "unread_notifications_count": unread_notifications_count,
            "recent_audit_events": AuditEventSerializer(recent_audit_events, many=True).data,
        })
