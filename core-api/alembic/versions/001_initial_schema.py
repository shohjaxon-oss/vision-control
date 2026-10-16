"""Initial schema with multi-tenant organizations, users, biometrics, audit and attendance

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-16 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 0. Vector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 1. Organizations
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('timezone', sa.String(100), nullable=False, server_default='Asia/Tashkent'),
        sa.Column('shift_start', sa.Time(), nullable=False, server_default='09:00:00'),
        sa.Column('shift_end', sa.Time(), nullable=False, server_default='18:00:00'),
        sa.Column('retention_days', sa.Integer(), nullable=False, server_default='90'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 2. Users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='manager'),
        sa.Column('two_factor_secret', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('owner', 'manager', 'observer')", name='chk_user_role'),
        sa.UniqueConstraint('email', name='uq_users_email')
    )
    op.create_index('ix_users_org_id', 'users', ['organization_id'])

    # 3. Login Attempts (Rate limiting & Lockouts)
    op.create_table(
        'login_attempts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('ip_address', sa.String(50), nullable=False),
        sa.Column('failed_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('email', 'ip_address', name='uq_login_attempt_email_ip')
    )
    op.create_index('ix_login_attempts_email', 'login_attempts', ['email'])

    # 4. Refresh Tokens (Rotation & Revocation)
    op.create_table(
        'refresh_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('token_hash', name='uq_refresh_tokens_hash')
    )
    op.create_index('ix_refresh_tokens_user', 'refresh_tokens', ['user_id'])
    op.create_index('ix_refresh_tokens_family', 'refresh_tokens', ['family_id'])

    # 5. Sites
    op.create_table(
        'sites',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_sites_org', 'sites', ['organization_id'])

    # 6. Cameras
    op.create_table(
        'cameras',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sites.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), nullable=False, server_default='general'),
        sa.Column('status', sa.String(50), nullable=False, server_default='offline'),
        sa.Column('fps', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('latency_ms', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_frame_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rtsp_address_encrypted', sa.Text(), nullable=False),
        sa.Column('position', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("type IN ('entrance', 'exit', 'general')", name='chk_camera_type'),
        sa.CheckConstraint("status IN ('online', 'offline')", name='chk_camera_status'),
    )
    op.create_index('ix_cameras_org', 'cameras', ['organization_id'])

    # 7. Employees
    op.create_table(
        'employees',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('position', sa.String(100), nullable=False),
        sa.Column('department', sa.String(100), nullable=False),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('consent_status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('consent_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('enrollment_status', sa.String(50), nullable=False, server_default='none'),
        sa.Column('enrollment_samples', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("consent_status IN ('granted', 'denied', 'revoked', 'pending')", name='chk_employee_consent_status'),
        sa.CheckConstraint("enrollment_status IN ('enrolled', 'partial', 'none')", name='chk_employee_enrollment_status'),
    )
    op.create_index('ix_employees_org', 'employees', ['organization_id'])
    op.create_index('ix_employees_org_name', 'employees', ['organization_id', 'first_name', 'last_name'])

    # 8. Consent Documents (Legal compliance ZRU-1125)
    op.create_table(
        'consent_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
        sa.Column('granted', sa.Boolean(), nullable=False),
        sa.Column('version', sa.String(20), nullable=False, server_default='1.0'),
        sa.Column('method', sa.String(50), nullable=False, server_default='electronic'),
        sa.Column('document_ref', sa.String(255), nullable=True),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('granted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("method IN ('paper', 'electronic')", name='chk_consent_method'),
    )
    op.create_index('ix_consent_documents_emp', 'consent_documents', ['employee_id'])

    # 9. Face Embeddings (128-d pgvector)
    op.create_table(
        'face_embeddings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
        sa.Column('embedding', Vector(128), nullable=False),
        sa.Column('quality_score', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_face_embeddings_emp', 'face_embeddings', ['employee_id'])
    op.create_index('ix_face_embeddings_org_emp', 'face_embeddings', ['organization_id', 'employee_id'])

    # 10. Shifts
    op.create_table(
        'shifts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 11. Attendance Events
    op.create_table(
        'attendance_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
        sa.Column('camera_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cameras.id', ondelete='SET NULL'), nullable=True),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('snapshot_path', sa.Text(), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('reviewed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('feedback', sa.Boolean(), nullable=True),
        sa.CheckConstraint("event_type IN ('enter', 'exit', 'seen')", name='chk_att_event_type'),
    )
    op.create_index('ix_att_events_emp_time', 'attendance_events', ['employee_id', 'occurred_at'])
    op.create_index('ix_att_events_cam_time', 'attendance_events', ['camera_id', 'occurred_at'])
    op.create_index('ix_att_events_org_time', 'attendance_events', ['organization_id', 'occurred_at'])

    # 12. Attendance Days
    op.create_table(
        'attendance_days',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('first_seen', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='absent'),
        sa.Column('late_minutes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_present_minutes', sa.Integer(), nullable=False, server_default='0'),
        sa.UniqueConstraint('employee_id', 'date', name='uq_attendance_days_employee_date'),
        sa.CheckConstraint("status IN ('present', 'absent', 'missing')", name='chk_att_day_status'),
    )
    op.create_index('ix_att_days_org_date', 'attendance_days', ['organization_id', 'date'])

    # 13. Unknown Faces
    op.create_table(
        'unknown_faces',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('camera_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cameras.id', ondelete='SET NULL'), nullable=True),
        sa.Column('snapshot_path', sa.Text(), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('resolution', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('resolved_employee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='SET NULL'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("resolution IN ('pending', 'linked', 'guest', 'ignored')", name='chk_unknown_resolution'),
    )
    op.create_index('ix_unknown_faces_org_res', 'unknown_faces', ['organization_id', 'resolution', 'occurred_at'])

    # 14. Immutable Audit Logs with Chained Hash
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_email', sa.String(255), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity', sa.String(100), nullable=False),
        sa.Column('entity_id', sa.String(100), nullable=True),
        sa.Column('details', postgresql.JSONB(), nullable=True),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('prev_hash', sa.String(64), nullable=True),
        sa.Column('row_hash', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_audit_logs_org_time', 'audit_logs', ['organization_id', 'created_at'])

    # 15. Ask Logs
    op.create_table(
        'ask_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('functions_called', postgresql.JSONB(), nullable=True),
        sa.Column('response', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

def downgrade() -> None:
    op.drop_table('ask_logs')
    op.drop_table('audit_logs')
    op.drop_table('unknown_faces')
    op.drop_table('attendance_days')
    op.drop_table('attendance_events')
    op.drop_table('shifts')
    op.drop_table('face_embeddings')
    op.drop_table('consent_documents')
    op.drop_table('employees')
    op.drop_table('cameras')
    op.drop_table('sites')
    op.drop_table('refresh_tokens')
    op.drop_table('login_attempts')
    op.drop_table('users')
    op.drop_table('organizations')
