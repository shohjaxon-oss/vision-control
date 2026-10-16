import json
import uuid
from typing import Optional, Any, Dict
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import AuditLog
from security import compute_audit_hash

async def log_audit_event(
    db: AsyncSession,
    organization_id: uuid.UUID,
    action: str,
    entity: str,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
    user_id: Optional[uuid.UUID] = None,
    user_email: Optional[str] = None,
) -> AuditLog:
    """
    Appends an immutable audit log entry with SHA-256 chained hash integrity.
    """
    # Extract client IP and user agent
    ip_address = "127.0.0.1"
    user_agent = "system"
    if request:
        client = request.client
        ip_address = client.host if client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        # Check if user attached to state
        if not user_id and hasattr(request.state, "user") and request.state.user:
            user_id = request.state.user.id
            user_email = request.state.user.email

    # Retrieve last log entry hash for chained ledger
    stmt = (
        select(AuditLog.row_hash)
        .where(AuditLog.organization_id == organization_id)
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    prev_hash = result.scalar_one_or_none() or "GENESIS"

    # Compute row signature
    data_to_hash = json.dumps({
        "org": str(organization_id),
        "user": str(user_id) if user_id else None,
        "action": action,
        "entity": entity,
        "entity_id": str(entity_id) if entity_id else None,
        "details": details,
        "ip": ip_address
    }, sort_keys=True)

    row_hash = compute_audit_hash(prev_hash, data_to_hash)

    audit_entry = AuditLog(
        organization_id=organization_id,
        user_id=user_id,
        user_email=user_email,
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id else None,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent[:500] if user_agent else None,
        prev_hash=prev_hash,
        row_hash=row_hash
    )
    db.add(audit_entry)
    return audit_entry
