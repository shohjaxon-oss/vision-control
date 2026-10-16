import os
import time
import pytest
from security import (
    verify_password, get_password_hash,
    create_access_token, create_2fa_challenge_token, create_live_ticket,
    decode_token, encrypt_data, decrypt_data,
    generate_totp_secret, verify_totp,
    generate_service_signature, verify_service_signature,
    compute_audit_hash
)
from errors import AppException
from routers.reports import sanitize_csv_cell

def test_argon2_password_hashing():
    pw = "SuperSecure_Pass_2026!#"
    hashed = get_password_hash(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("wrong_password", hashed) is False

def test_aes_gcm_encryption_decryption():
    secret_text = "rtsp://admin:camera_secure_pass@192.168.1.100:554/live"
    ciphertext = encrypt_data(secret_text)
    assert ciphertext != secret_text
    decrypted = decrypt_data(ciphertext)
    assert decrypted == secret_text

def test_jwt_access_and_challenge_tokens():
    user_id = "11111111-2222-3333-4444-555555555555"
    org_id = "99999999-8888-7777-6666-555555555555"

    # Access Token
    access_token = create_access_token(user_id, "manager", org_id)
    payload = decode_token(access_token, expected_typ="access", expected_aud="wfv-api")
    assert payload["sub"] == user_id
    assert payload["role"] == "manager"
    assert payload["typ"] == "access"

    # Challenge Token (cannot be used as API access token!)
    challenge_token = create_2fa_challenge_token(user_id, org_id)
    with pytest.raises(AppException) as exc:
        decode_token(challenge_token, expected_typ="access", expected_aud="wfv-api")
    assert exc.value.status_code == 401

    # But valid as 2FA challenge token
    ch_payload = decode_token(challenge_token, expected_typ="challenge", expected_aud="wfv-2fa")
    assert ch_payload["sub"] == user_id

def test_live_ticket_token():
    cam_id = "cam-101"
    org_id = "org-1"
    user_id = "u-1"
    ticket = create_live_ticket(cam_id, org_id, user_id)
    payload = decode_token(ticket, expected_typ="live", expected_aud="wfv-live")
    assert payload["cam"] == cam_id
    assert payload["aud"] == "wfv-live"

def test_totp_verification():
    import pyotp
    secret = generate_totp_secret()
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    assert verify_totp(secret, valid_code) is True
    assert verify_totp(secret, "000000") is False
    assert verify_totp(secret, "123456") is False # Fake test code MUST fail

def test_hmac_service_signature():
    method = "POST"
    path = "/api/v1/internal/events"
    body = b'{"camera_id": "test"}'
    ts = int(time.time())

    sig = generate_service_signature(method, path, ts, body)
    assert verify_service_signature(method, path, str(ts), sig, body) is True

    # Replay attack with expired timestamp (> 60s) must be rejected
    old_ts = ts - 120
    old_sig = generate_service_signature(method, path, old_ts, body)
    assert verify_service_signature(method, path, str(old_ts), old_sig, body) is False

    # Tampered body must be rejected
    assert verify_service_signature(method, path, str(ts), sig, b'tampered') is False

def test_audit_chained_hash():
    genesis_hash = compute_audit_hash(None, '{"action": "first"}')
    second_hash = compute_audit_hash(genesis_hash, '{"action": "second"}')
    assert len(genesis_hash) == 64
    assert len(second_hash) == 64
    assert genesis_hash != second_hash

def test_csv_injection_sanitization():
    # Dangerous values that could trigger spreadsheet formula execution
    assert sanitize_csv_cell("=1+1") == "'=1+1"
    assert sanitize_csv_cell("+cmd|' /C calc'!A0") == "'+cmd|' /C calc'!A0"
    assert sanitize_csv_cell("-2+3") == "'-2+3"
    assert sanitize_csv_cell("@SUM(1,2)") == "'@SUM(1,2)"
    # Safe values
    assert sanitize_csv_cell("Bekzod Karimov") == "Bekzod Karimov"
    assert sanitize_csv_cell("Menejer") == "Menejer"
