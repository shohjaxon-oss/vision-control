from typing import Any, Dict, Optional
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

class AppException(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.details = details or {}

def create_error_response(status_code: int, code: str, message: str, details: Optional[Dict[str, Any]] = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "code": code,
            "message": message,
            "details": details or {}
        }
    )

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return create_error_response(
        status_code=exc.status_code,
        code=exc.code,
        message=exc.message,
        details=exc.details
    )

async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    # Standardize FastAPI default HTTPExceptions
    code_map = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "validation_error",
        429: "rate_limited",
        500: "internal_server_error"
    }
    code = code_map.get(exc.status_code, "error")
    message = str(exc.detail) if isinstance(exc.detail, str) else "Xatolik yuz berdi"
    details = exc.detail if isinstance(exc.detail, dict) else {}
    return create_error_response(
        status_code=exc.status_code,
        code=code,
        message=message,
        details=details
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    details = {"errors": errors}
    
    first_err = errors[0] if errors else None
    if first_err:
        loc = " -> ".join(str(l) for l in first_err.get("loc", []))
        msg = first_err.get("msg", "Noto'g'ri ma'lumot kiritildi")
        message = f"Validatsiya xatosi ({loc}): {msg}"
    else:
        message = "Kiritilgan ma'lumotlar formati noto'g'ri"

    return create_error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        code="validation_error",
        message=message,
        details=details
    )

async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Do not leak internal stack traces or database info in production
    import logging
    logging.getLogger("uvicorn.error").exception(f"Unhandled exception: {exc}")
    return create_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="internal_error",
        message="Serverda kutilmagan xatolik yuz berdi. Iltimos keyinroq qayta urinib ko'ring.",
        details={}
    )
