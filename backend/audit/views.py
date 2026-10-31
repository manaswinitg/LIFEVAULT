from rest_framework import views, permissions
from rest_framework.response import Response
from .models import AuditEvent
from .serializers import AuditEventSerializer
from .service import verify_audit_chain

class AuditEventListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Ordinary users see their own actions or actions on their resources
        events = AuditEvent.objects.filter(actor=request.user).order_by('-timestamp')[:100]
        serializer = AuditEventSerializer(events, many=True)
        return Response(serializer.data)


class AuditChainVerifyView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        is_valid, broken_id, msg = verify_audit_chain()
        total_events = AuditEvent.objects.count()
        return Response({
            "is_valid": is_valid,
            "broken_event_id": broken_id,
            "total_events": total_events,
            "message": msg
        })
