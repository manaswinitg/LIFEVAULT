import hashlib
import json
from datetime import datetime, timezone
from django.db import transaction
from .models import AuditEvent

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

def get_client_ip(request):
    """Safely extracts client IP address from HTTP headers."""
    if not request:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')

def get_client_user_agent(request):
    if not request:
        return ""
    return request.META.get('HTTP_USER_AGENT', '')[:500]

def compute_event_hash(prev_hash, timestamp_str, actor_id, action, target_type, target_id, details):
    """
    Computes deterministic SHA-256 hash chaining to prev_hash.
    """
    canonical_details = json.dumps(details, sort_keys=True, separators=(',', ':'))
    payload = f"{prev_hash}|{timestamp_str}|{actor_id}|{action}|{target_type}|{target_id}|{canonical_details}"
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()

@transaction.atomic
def record_audit_event(action, actor=None, target_type="", target_id="", details=None, request=None):
    """
    Appends an immutable audit event to the tamper-evident chain.
    """
    if details is None:
        details = {}

    # Redact any accidental sensitive credentials
    sanitized_details = {}
    sensitive_keys = {'password', 'token', 'secret', 'key', 'credential', 'auth', 'nonce'}
    for k, v in details.items():
        if any(sens in k.lower() for sens in sensitive_keys):
            sanitized_details[k] = "[REDACTED]"
        else:
            sanitized_details[k] = str(v) if not isinstance(v, (int, float, bool, dict, list, type(None))) else v

    last_event = AuditEvent.objects.select_for_update().order_by('-timestamp', '-id').first()
    prev_hash = last_event.current_hash if last_event and last_event.current_hash else GENESIS_HASH

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    actor_str = str(actor.id) if actor else "ANONYMOUS"

    current_hash = compute_event_hash(
        prev_hash=prev_hash,
        timestamp_str=now_iso,
        actor_id=actor_str,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        details=sanitized_details
    )

    ip = get_client_ip(request)
    ua = get_client_user_agent(request)

    event = AuditEvent.objects.create(
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        ip_address=ip,
        user_agent=ua,
        details=sanitized_details,
        prev_hash=prev_hash,
        current_hash=current_hash
    )
    return event

def verify_audit_chain():
    """
    Verifies cryptographic integrity of the entire audit log chain.
    Returns (is_valid: bool, broken_event_id: str | None).
    """
    events = AuditEvent.objects.order_by('timestamp', 'id')
    expected_prev_hash = GENESIS_HASH

    for event in events:
        if event.prev_hash != expected_prev_hash:
            return False, str(event.id), f"Chain broken at event {event.id}: prev_hash mismatch."
        
        expected_prev_hash = event.current_hash

    return True, None, "Audit chain integrity verified."
