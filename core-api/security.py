import os
import time
import base64
import hmac
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import pyotp
from config import settings
from errors import AppException

# Argon2id password hasher
ph = PasswordHasher(
    time_cost=2,
    memory_cost=65536, # 64MB
    parallelism=2,
    hash_len=32,
    salt_len=16
)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHash):
        return False

def get_password_hash(password: str) -> str:
    return ph.hash(password)

def create_access_token(user_id: str, role: str, org_id: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "org_id": str(org_id),
        "typ": "access",
        "aud": "wfv-api",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def create_2fa_challenge_token(user_id: str, org_id: str) -> str:
    """Short-lived 5-minute token strictly for completing 2FA."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.CHALLENGE_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "org_id": str(org_id),
        "typ": "challenge",
        "aud": "wfv-2fa",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def create_live_ticket(camera_id: str, org_id: str, user_id: str) -> str:
    """Single-use 30-second ticket strictly for authenticated camera WebRTC/MSE stream."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(seconds=settings.LIVE_TICKET_EXPIRE_SECONDS)
    payload = {
        "sub": str(user_id),
        "cam": str(camera_id),
        "org_id": str(org_id),
        "typ": "live",
        "aud": "wfv-live",
        "jti": base64.urlsafe_b64encode(os.urandom(16)).decode('utf-8').rstrip('='),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str, expected_typ: str, expected_aud: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            audience=expected_aud,
            options={"require": ["exp", "sub", "typ", "aud"]}
        )
        if payload.get("typ") != expected_typ:
            raise AppException(
                status_code=401,
                code="invalid_token_type",
                message="Token turi yaroqsiz"
            )
        return payload
    except jwt.ExpiredSignatureError:
        raise AppException(
            status_code=401,
            code="token_expired",
            message="Sessiya muddati tugagan. Qaytadan tizimga kiring."
        )
    except jwt.InvalidTokenError as e:
        raise AppException(
            status_code=401,
            code="invalid_token",
            message="Noto'g'ri yoki buzilgan avtorizatsiya tokeni"
        )

# AES-256-GCM Encryption / Decryption
def get_aes_key() -> bytes:
    return bytes.fromhex(settings.AES_ENCRYPTION_KEY)

def encrypt_data(plaintext: str) -> str:
    aesgcm = AESGCM(get_aes_key())
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
    return base64.b64encode(nonce + ciphertext).decode('utf-8')

def decrypt_data(ciphertext_b64: str) -> str:
    raw = base64.b64decode(ciphertext_b64.encode('utf-8'))
    nonce = raw[:12]
    ciphertext = raw[12:]
    aesgcm = AESGCM(get_aes_key())
    decrypted = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted.decode('utf-8')

# TOTP 2FA
def generate_totp_secret() -> str:
    return pyotp.random_base32()

def get_totp_uri(secret: str, email: str, issuer: str = "VisionControl") -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=issuer)

def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    # Remove any spaces
    cleaned = code.strip().replace(" ", "")
    totp = pyotp.TOTP(secret)
    return totp.verify(cleaned, valid_window=1)

# HMAC service-to-service authentication (vision-worker -> core-api)
def generate_service_signature(method: str, path: str, timestamp: int, body_bytes: bytes = b"") -> str:
    key = settings.INTERNAL_SERVICE_SECRET.encode('utf-8')
    body_hash = hashlib.sha256(body_bytes).hexdigest()
    msg = f"{method.upper()}|{path}|{timestamp}|{body_hash}".encode('utf-8')
    return hmac.new(key, msg, hashlib.sha256).hexdigest()

def verify_service_signature(method: str, path: str, timestamp_str: str, signature: str, body_bytes: bytes = b"") -> bool:
    try:
        ts = int(timestamp_str)
    except (ValueError, TypeError):
        return False
    # 60 seconds tolerance window to prevent replay attacks
    now = int(time.time())
    if abs(now - ts) > 60:
        return False
    expected = generate_service_signature(method, path, ts, body_bytes)
    return hmac.compare_digest(expected, signature)

# Chained hash computation for immutable audit logs
def compute_audit_hash(prev_hash: Optional[str], row_data: str) -> str:
    raw = f"{prev_hash or 'GENESIS'}|{row_data}".encode('utf-8')
    return hashlib.sha256(raw).hexdigest()
