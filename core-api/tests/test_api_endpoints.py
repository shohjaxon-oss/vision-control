import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "version" in data

@pytest.mark.asyncio
async def test_all_endpoints_require_authentication():
    """
    CRITICAL SECURITY CHECK (Prompt Section 11):
    Verifies that every sensitive endpoint strictly rejects unauthenticated requests with 401.
    """
    protected_endpoints = [
        ("GET", "/api/v1/me"),
        ("GET", "/api/v1/users"),
        ("GET", "/api/v1/organization"),
        ("GET", "/api/v1/audit-logs"),
        ("GET", "/api/v1/employees"),
        ("POST", "/api/v1/employees"),
        ("GET", "/api/v1/cameras"),
        ("POST", "/api/v1/cameras"),
        ("GET", "/api/v1/attendance"),
        ("GET", "/api/v1/unknown-faces"),
        ("GET", "/api/v1/reports/attendance?from=2026-10-01&to=2026-10-02"),
        ("POST", "/api/v1/ask"),
        ("GET", "/api/v1/stream/events")
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for method, path in protected_endpoints:
            if method == "GET":
                res = await client.get(path)
            elif method == "POST":
                res = await client.post(path, json={})

            assert res.status_code == 401, f"Endpoint {method} {path} must return 401 when unauthenticated, got {res.status_code}"
            
            # Verify standard error format: {"code", "message", "details"}
            body = res.json()
            assert "code" in body, f"Error format must contain 'code' on {path}"
            assert "message" in body, f"Error format must contain 'message' on {path}"
            assert "details" in body, f"Error format must contain 'details' on {path}"

@pytest.mark.asyncio
async def test_validation_error_format():
    """
    Verifies 422 validation errors adhere strictly to {"code", "message", "details"}.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={"invalid": "payload"})
        assert res.status_code == 422
        body = res.json()
        assert body["code"] == "validation_error"
        assert "message" in body
        assert "details" in body

@pytest.mark.asyncio
async def test_cors_headers_strict():
    """
    Verifies CORS headers do not contain wildcard (*).
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.options(
            "/api/v1/auth/login",
            headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"}
        )
        origin_header = res.headers.get("access-control-allow-origin")
        assert origin_header != "*"
        assert origin_header == "http://localhost:5173"
