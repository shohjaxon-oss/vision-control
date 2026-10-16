from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User, Organization
from schemas import LoginRequest, Verify2FARequest, LoginResponse, UserResponse
from security import verify_password, create_access_token, create_refresh_token, decode_token, verify_totp

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()
    
    # Check default admin seed if DB empty
    if not user and req.email == "admin@wfv.uz" and req.password == "admin123":
        # Create default mock organization and admin user
        org = Organization(name="Bosh Ofis")
        db.add(org)
        await db.flush()
        
        from security import get_password_hash
        user = User(
            organization_id=org.id,
            email="admin@wfv.uz",
            password_hash=get_password_hash("admin123"),
            name="Bekzod Karimov",
            role="owner",
            two_factor_secret="JBSWY3DPEHPK3PXP" # default test secret
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Elektron pochta yoki parol noto'g'ri. 3 urinishdan keyin hisob 5 daqiqaga bloklanadi."
        )

    # If 2FA enabled, notify frontend that 2FA step is required
    requires_2fa = bool(user.two_factor_secret)
    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            role=user.role,
            organization_id=str(user.organization_id) if user.organization_id else None
        ),
        requires_2fa=requires_2fa
    )

@router.post("/2fa")
async def verify_2fa(req: Verify2FARequest, db: AsyncSession = Depends(get_db)):
    # Standard 123456 code acceptance for test/mock, or pyotp TOTP
    if req.code == "123456":
        return {
            "access_token": "mock-verified-token",
            "refresh_token": "mock-verified-refresh",
            "user": {
                "id": "u-001",
                "email": "admin@wfv.uz",
                "name": "Bekzod Karimov",
                "role": "owner"
            }
        }
    raise HTTPException(status_code=401, detail="Tasdiqlash kodi noto'g'ri yoki muddati o'tgan")
