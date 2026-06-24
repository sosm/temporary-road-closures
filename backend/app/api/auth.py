"""
Authentication endpoints for the OSM Road Closures API.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import Optional
import urllib.parse
from fastapi.security import OAuth2PasswordRequestForm

from app.core.database import get_db
from app.core.exceptions import (
    AuthenticationException,
    ValidationException,
    ConflictException,
    NotFoundException,
)
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    OAuthCallback,
    PasswordReset,
    PasswordResetConfirm,
    EmailVerification,
    ChangePassword,
    ApiKeyResponse,
)
from app.services.user_service import UserService
from app.services.oauth_service import OAuthService
from app.api.deps import get_current_active_user
from app.models.user import User
from app.config import settings


router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user",
    description="Create a new user account with username, email, and password.",
)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account.

    - **username**: Unique username (3-50 characters, alphanumeric, hyphens, underscores)
    - **email**: Valid email address
    - **password**: Strong password (min 8 chars, uppercase, lowercase, digit)
    - **full_name**: Optional full name

    Returns the created user information (excluding password).
    Email verification may be required before full account activation.
    """
    try:
        user_service = UserService(db)
        user = user_service.create_user(user_data)

        return UserResponse.from_orm(user)

    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)
        )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="User login",
    description="Authenticate user and return access token (OAuth2 compatible).",
)
async def login(form_data: UserLogin = Depends(), db: Session = Depends(get_db)):
    """
    Authenticate user with username/email and password (OAuth2 compatible).

    This endpoint is compatible with both:
    - OAuth2PasswordRequestForm (for Swagger UI)
    - Direct JSON requests

    Args:
        form_data: OAuth2 form data with username and password
        db: Database session

    Returns:
        TokenResponse: Access token and user information

    Raises:
        HTTPException: If authentication fails
    """
    try:
        user_service = UserService(db)

        # Create UserLogin object from OAuth2 form data
        login_data = UserLogin(username=form_data.username, password=form_data.password)

        user = user_service.authenticate_user(login_data)

        # Create access token
        token_data = user_service.create_access_token_for_user(user)

        return TokenResponse(
            access_token=token_data["access_token"],
            token_type=token_data["token_type"],
            expires_in=token_data["expires_in"],
            user=UserResponse.from_orm(token_data["user"]),
        )

    except AuthenticationException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post(
    "/login-json",
    response_model=TokenResponse,
    summary="User login (JSON)",
    description="Authenticate user with JSON data (backward compatibility).",
)
async def login_json(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user with username/email and password using JSON.

    This endpoint maintains backward compatibility for direct JSON requests.

    Args:
        login_data: Login credentials as JSON
        db: Database session

    Returns:
        TokenResponse: Access token and user information
    """
    try:
        user_service = UserService(db)
        user = user_service.authenticate_user(login_data)

        # Create access token
        token_data = user_service.create_access_token_for_user(user)

        return TokenResponse(
            access_token=token_data["access_token"],
            token_type=token_data["token_type"],
            expires_in=token_data["expires_in"],
            user=UserResponse.from_orm(token_data["user"]),
        )

    except AuthenticationException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
    description="Get information about the currently authenticated user.",
)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """
    Get current user information.

    Requires authentication. Returns detailed information about the currently
    logged-in user including profile data, permissions, and account status.
    """
    return UserResponse.from_orm(current_user)


@router.post(
    "/change-password", summary="Change password", description="Change user password."
)
async def change_password(
    password_data: ChangePassword,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Change user password.

    - **current_password**: Current password for verification
    - **new_password**: New password (must meet strength requirements)

    Requires authentication. The user must provide their current password
    to change to a new password.
    """
    try:
        user_service = UserService(db)
        user_service.change_password(
            current_user.id, password_data.current_password, password_data.new_password
        )

        return {"message": "Password changed successfully"}

    except AuthenticationException as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except ValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)
        )


@router.post(
    "/regenerate-api-key",
    response_model=ApiKeyResponse,
    summary="Regenerate API key",
    description="Generate a new API key for the current user.",
)
async def regenerate_api_key(
    current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
):
    """
    Regenerate API key for the current user.

    Generates a new API key and invalidates the old one. The API key can be used
    for programmatic access to the API as an alternative to JWT tokens.

    Include the API key in requests using the X-API-Key header.
    """
    try:
        user_service = UserService(db)
        new_api_key = user_service.regenerate_api_key(current_user.id)

        return ApiKeyResponse(api_key=new_api_key, created_at=current_user.updated_at)

    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# OAuth Endpoints


@router.get(
    "/oauth/{provider}",
    summary="OAuth login",
    description="Initiate OAuth login with external provider.",
)
async def oauth_login(
    provider: str,
    request: Request,
    redirect_uri: Optional[str] = Query(None, description="Custom redirect URI"),
    redirect: Optional[str] = Query(None, description="Frontend redirect path after successful auth"),
):
    """
    Initiate OAuth login flow.

    **Supported providers:**
    - `google`: Google OAuth
    - `github`: GitHub OAuth
    - `osm`: OpenStreetMap OAuth

    **Parameters:**
    - **provider**: OAuth provider name
    - **redirect_uri**: Optional custom redirect URI (defaults to configured URI)
    - **redirect**: Optional frontend path to redirect to after successful authentication

    Returns a redirect to the OAuth provider's authorization page.
    After user authorization, they'll be redirected back to the callback endpoint.
    """
    if not settings.OAUTH_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OAuth authentication is disabled",
        )

    try:
        oauth_service = OAuthService()
        auth_url, state = oauth_service.get_authorization_url(provider, redirect_uri)

        # Store state in session/redis for validation
        # For simplicity, we'll add it as a query parameter to the callback
        # In production, use secure session storage

        response = RedirectResponse(url=auth_url)

        # Determine if we should use secure cookies based on the environment
        # Use secure cookies in production, but allow non-secure in development
        use_secure = not settings.DEBUG and settings.ENVIRONMENT == "production"

        # Set state cookie with appropriate security settings
        response.set_cookie(
            key=f"oauth_state_{provider}",
            value=state,
            max_age=600,  # 10 minutes
            httponly=True,
            secure=use_secure,
            samesite="lax",  # Allow cross-site for OAuth callback
        )

        # Store the frontend redirect path if provided
        if redirect:
            response.set_cookie(
                key=f"oauth_redirect_{provider}",
                value=redirect,
                max_age=600,  # 10 minutes
                httponly=True,
                secure=use_secure,
                samesite="lax",
            )

        return response

    except AuthenticationException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/oauth/{provider}/callback",
    summary="OAuth callback",
    description="Handle OAuth provider callback and complete authentication.",
)
async def oauth_callback(
    provider: str,
    request: Request,
    code: Optional[str] = Query(None, description="Authorization code"),
    state: Optional[str] = Query(None, description="State parameter"),
    error: Optional[str] = Query(None, description="OAuth error"),
    db: Session = Depends(get_db),
):
    """
    Handle OAuth callback from provider.

    This endpoint is called by the OAuth provider after user authorization.
    It exchanges the authorization code for an access token and creates/updates
    the user account.

    **Parameters:**
    - **provider**: OAuth provider name
    - **code**: Authorization code from provider
    - **state**: State parameter for security validation
    - **error**: Error message if OAuth failed

    On success, redirects to the frontend with authentication token.
    On error, redirects to the frontend with error message.
    """
    if not settings.OAUTH_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OAuth authentication is disabled",
        )

    # Get the stored redirect path (defaults to /closures if not specified)
    frontend_redirect = request.cookies.get(f"oauth_redirect_{provider}") or "/closures"

    # Check for OAuth errors
    if error:
        error_url = (
            f"{settings.FRONTEND_URL}{settings.OAUTH_ERROR_REDIRECT}&reason={error}"
        )
        return RedirectResponse(url=error_url)

    if not code or not state:
        error_url = f"{settings.FRONTEND_URL}{settings.OAUTH_ERROR_REDIRECT}&reason=missing_parameters"
        return RedirectResponse(url=error_url)

    try:
        # Validate state parameter
        stored_state = request.cookies.get(f"oauth_state_{provider}")
        if not stored_state:
            print(f"❌ OAuth callback error: No stored state found for provider {provider}")
            error_url = f"{settings.FRONTEND_URL}{settings.OAUTH_ERROR_REDIRECT}&reason=missing_state"
            return RedirectResponse(url=error_url)

        if stored_state != state:
            print(f"❌ OAuth callback error: State mismatch for provider {provider}")
            error_url = f"{settings.FRONTEND_URL}{settings.OAUTH_ERROR_REDIRECT}&reason=invalid_state"
            return RedirectResponse(url=error_url)

        print(f"✅ OAuth state validation successful for provider {provider}")

        # Exchange code for token and get user info
        oauth_service = OAuthService()
        access_token = await oauth_service.exchange_code_for_token(
            provider, code, state
        )
        print(f"✅ OAuth access token obtained for provider {provider}")

        oauth_user = await oauth_service.get_user_info(provider, access_token)
        print(f"✅ OAuth user info retrieved: {oauth_user.username or oauth_user.name} ({oauth_user.provider_id})")

        # Create or get user
        user_service = UserService(db)
        user = user_service.create_or_get_oauth_user(oauth_user)
        print(f"✅ User created/updated in database: {user.username} (ID: {user.id})")

        # Create JWT token for our application
        token_data = user_service.create_access_token_for_user(user)

        # Redirect to frontend with token (use stored redirect path)
        success_url = f"{settings.FRONTEND_URL}{frontend_redirect}"
        # Use hash parameter if redirect already has query params
        if "?" in frontend_redirect:
            success_url += f"&token={token_data['access_token']}&expires_in={token_data['expires_in']}"
        else:
            success_url += f"?token={token_data['access_token']}&expires_in={token_data['expires_in']}"

        print(f"✅ OAuth login successful, redirecting to: {frontend_redirect}")

        response = RedirectResponse(url=success_url)

        # Clear OAuth cookies
        response.delete_cookie(f"oauth_state_{provider}")
        response.delete_cookie(f"oauth_redirect_{provider}")

        return response

    except Exception as e:
        print(f"❌ OAuth callback error for provider {provider}: {str(e)}")
        print(f"   Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        error_url = f"{settings.FRONTEND_URL}{settings.OAUTH_ERROR_REDIRECT}&reason=authentication_failed&details={str(e)[:100]}"
        return RedirectResponse(url=error_url)


# Email Verification Endpoints


@router.post(
    "/send-verification",
    summary="Send email verification",
    description="Send email verification link to user.",
)
async def send_email_verification(
    current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
):
    """
    Send email verification link.

    Sends an email verification link to the user's email address.
    This is required for users who registered with username/password.
    OAuth users are automatically verified.
    """
    try:
        user_service = UserService(db)
        verification_token = user_service.send_email_verification(current_user.id)

        # In a real application, send email here
        # For development, return the token
        if settings.DEBUG:
            return {
                "message": "Verification email would be sent",
                "verification_token": verification_token,  # Only in debug mode
            }
        else:
            return {"message": "Verification email sent"}

    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/verify-email",
    summary="Verify email",
    description="Verify user email with verification token.",
)
async def verify_email(
    verification_data: EmailVerification, db: Session = Depends(get_db)
):
    """
    Verify user email address.

    - **token**: Email verification token received via email

    Verifies the user's email address using the token sent to their email.
    Once verified, the user gains full access to the platform.
    """
    try:
        user_service = UserService(db)
        success = user_service.verify_email(verification_data.token)

        if success:
            return {"message": "Email verified successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email verification failed",
            )

    except AuthenticationException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# Password Reset Endpoints (placeholder for future implementation)


@router.post(
    "/password-reset",
    summary="Request password reset",
    description="Request password reset link (placeholder).",
)
async def request_password_reset(
    reset_data: PasswordReset, db: Session = Depends(get_db)
):
    """
    Request password reset link.

    - **email**: Email address for password reset

    Sends a password reset link to the user's email address.
    Note: This is a placeholder implementation.
    """
    # Placeholder implementation
    return {"message": "Password reset link would be sent to your email"}


@router.post(
    "/password-reset/confirm",
    summary="Confirm password reset",
    description="Confirm password reset with token (placeholder).",
)
async def confirm_password_reset(
    reset_data: PasswordResetConfirm, db: Session = Depends(get_db)
):
    """
    Confirm password reset with token.

    - **token**: Password reset token
    - **new_password**: New password

    Resets the user's password using the reset token.
    Note: This is a placeholder implementation.
    """
    # Placeholder implementation
    return {"message": "Password reset completed"}


@router.post(
    "/logout",
    summary="User logout",
    description="Logout user (client-side token invalidation).",
)
async def logout():
    """
    Logout user.

    Since we're using stateless JWT tokens, logout is primarily handled
    on the client side by removing the token. In a production system,
    you might implement token blacklisting for enhanced security.
    """
    return {"message": "Logged out successfully"}


# Development/Testing Endpoints

if settings.DEBUG:

    @router.get(
        "/dev/test-oauth",
        summary="Test OAuth flow (development only)",
        description="Test OAuth configuration (development only).",
    )
    async def test_oauth_config():
        """
        Test OAuth configuration (development only).

        Returns OAuth configuration status for debugging.
        Only available in development mode.
        """
        oauth_service = OAuthService()

        config_status = {
            "oauth_enabled": settings.OAUTH_ENABLED,
            "google_configured": bool(
                settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET
            ),
            "github_configured": bool(
                settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET
            ),
            "available_providers": list(oauth_service.providers.keys()),
            "frontend_url": settings.FRONTEND_URL,
            "redirect_uris": {
                "google": settings.GOOGLE_REDIRECT_URI,
                "github": settings.GITHUB_REDIRECT_URI,
            },
        }

        return config_status
