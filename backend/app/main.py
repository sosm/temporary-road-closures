"""
FastAPI application for OSM Road Closures API with proper Swagger authentication and OpenLR integration.
"""

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.security import HTTPBearer
import time
import logging
from contextlib import asynccontextmanager

from app.config import settings
from app.core.database import init_database, close_database
from app.core.exceptions import APIException, ValidationException
from app.api import closures, users, auth
from app.api import openlr  # Import OpenLR endpoints
from app.api import import_data  # Import data import endpoints


# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL), format=settings.LOG_FORMAT
)
logger = logging.getLogger(__name__)

# Security scheme for Swagger UI
security = HTTPBearer()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager for startup and shutdown events.
    """
    # Startup
    logger.info("Starting OSM Road Closures API...")
    try:
        await init_database()
        logger.info("Database initialized successfully")

        # Log OpenLR status
        if settings.OPENLR_ENABLED:
            logger.info(f"OpenLR service enabled - Format: {settings.OPENLR_FORMAT}")
        else:
            logger.info("OpenLR service disabled")

    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

    yield

    # Shutdown
    logger.info("Shutting down OSM Road Closures API...")
    try:
        await close_database()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)


# FIXED: Add middleware with proper configuration for production
# Disable TrustedHostMiddleware in production as it's causing issues
# Only use it if specifically configured hosts are provided
if settings.ALLOWED_HOSTS != ["*"] and len(settings.ALLOWED_HOSTS) > 0:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)

# FIXED: More permissive CORS for production with health checks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.is_development else settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add response time header to all requests."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# FIXED: Health check middleware to handle container health checks
@app.middleware("http")
async def health_check_middleware(request: Request, call_next):
    """Handle health check requests with proper headers."""
    # For health checks, bypass host validation
    if request.url.path in ["/health", "/health/detailed"]:
        # Ensure proper response headers for health checks
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-cache"
        return response

    return await call_next(request)


# Exception handlers
@app.exception_handler(APIException)
async def api_exception_handler(request: Request, exc: APIException):
    """Handle custom API exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.error_code,
            "message": exc.message,
            "details": exc.details,
        },
    )


@app.exception_handler(ValidationException)
async def validation_exception_handler(request: Request, exc: ValidationException):
    """Handle validation exceptions."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "validation_error",
            "message": "Validation failed",
            "details": exc.errors,
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle standard HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "http_error",
            "message": exc.detail,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(500)
async def internal_server_error_handler(request: Request, exc: Exception):
    """Handle internal server errors."""
    logger.error(f"Internal server error: {exc}", exc_info=True)

    if settings.DEBUG:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "internal_server_error",
                "message": str(exc),
                "type": exc.__class__.__name__,
            },
        )
    else:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "internal_server_error",
                "message": "An internal server error occurred",
            },
        )


@app.get(
    "/health",
    summary="Basic health check",
    description="Basic health check endpoint for load balancers and monitoring",
    tags=["health"],
)
async def health_check():
    """
    Basic health check endpoint.

    Returns simple health status for load balancers and container orchestration.
    This endpoint is optimized for fast response times.
    """
    try:
        from app.core.database import db_manager

        # Quick database check
        db_healthy = db_manager.health_check()

        return {
            "status": "healthy" if db_healthy else "degraded",
            "timestamp": time.time(),
            "service": "osm-road-closures-api",
            "version": settings.VERSION,
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "timestamp": time.time(),
                "service": "osm-road-closures-api",
                "error": str(e) if settings.DEBUG else "Service unavailable",
            },
        )


@app.get(
    "/health/detailed",
    summary="Detailed health check",
    description="Comprehensive health check with system information",
    tags=["health"],
)
async def detailed_health_check():
    """
    Detailed health check with system information.

    Provides comprehensive system health information including:
    - Database connectivity
    - System resources
    - Service configuration
    - OpenLR status
    """
    try:
        from app.core.database import db_manager
        import platform

        db_info = db_manager.get_database_info()
        db_healthy = "error" not in db_info

        try:
            import psutil

            system_info = {
                "platform": platform.platform(),
                "python_version": platform.python_version(),
                "cpu_count": psutil.cpu_count(),
                "memory_total": psutil.virtual_memory().total,
                "memory_available": psutil.virtual_memory().available,
                "disk_usage": psutil.disk_usage("/").percent,
                "load_average": (
                    psutil.getloadavg() if hasattr(psutil, "getloadavg") else None
                ),
            }
        except ImportError:
            system_info = {
                "platform": platform.platform(),
                "python_version": platform.python_version(),
                "note": "psutil not available for detailed system metrics",
            }

        return {
            "status": "healthy" if db_healthy else "degraded",
            "timestamp": time.time(),
            "service": "osm-road-closures-api",
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "debug": settings.DEBUG,
            "database": db_info,
            "system": system_info,
            "features": {
                "openlr_enabled": settings.OPENLR_ENABLED,
                "oauth_enabled": settings.OAUTH_ENABLED,
                "rate_limiting": settings.RATE_LIMIT_ENABLED,
            },
            "openlr": {
                "enabled": settings.OPENLR_ENABLED,
                "format": settings.OPENLR_FORMAT if settings.OPENLR_ENABLED else None,
                "settings": settings.openlr_settings if settings.OPENLR_ENABLED else {},
            },
        }
    except Exception as e:
        logger.error(f"Detailed health check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "timestamp": time.time(),
                "service": "osm-road-closures-api",
                "error": str(e) if settings.DEBUG else "Service unavailable",
            },
        )


@app.get(
    "/",
    summary="API root",
    description="Root endpoint with API information and quick start guide",
    tags=["root"],
)
async def root():
    """
    Root endpoint with API information.

    Provides API overview, available endpoints, and quick start instructions.
    """
    return {
        "message": "OSM Road Closures API",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "status": "running",
        "documentation": {
            "swagger_ui": f"{settings.API_V1_STR}/docs",
            "redoc": f"{settings.API_V1_STR}/redoc",
            "openapi_schema": f"{settings.API_V1_STR}/openapi.json",
        },
        "health": {
            "basic": "/health",
            "detailed": "/health/detailed",
        },
        "features": {
            "openlr_enabled": settings.OPENLR_ENABLED,
            "oauth_enabled": settings.OAUTH_ENABLED,
        },
        "endpoints": {
            "closures": f"{settings.API_V1_STR}/closures",
            "users": f"{settings.API_V1_STR}/users",
            "auth": f"{settings.API_V1_STR}/auth",
            "openlr": f"{settings.API_V1_STR}/openlr",
            "import": f"{settings.API_V1_STR}/import",
        },
        "quick_start": {
            "step_1": "View API docs at /api/v1/docs",
            "step_2": "Register a user at /api/v1/auth/register",
            "step_3": "Login at /api/v1/auth/login to get access token",
            "step_4": "Click 'Authorize' button in docs and enter: Bearer <your_token>",
            "step_5": "Use authenticated endpoints to create and query closures",
        },
        "example_urls": {
            "health_check": "/health",
            "api_docs": f"{settings.API_V1_STR}/docs",
            "register": f"{settings.API_V1_STR}/auth/register",
            "login": f"{settings.API_V1_STR}/auth/login",
            "closures": f"{settings.API_V1_STR}/closures",
        },
    }


# Ping endpoint for simple connectivity tests
@app.get(
    "/ping",
    summary="Simple ping",
    description="Simple connectivity test endpoint",
    tags=["health"],
)
async def ping():
    """Simple ping endpoint for connectivity testing."""
    return {"ping": "pong", "timestamp": time.time()}


# Include routers
app.include_router(
    closures.router, prefix=f"{settings.API_V1_STR}/closures", tags=["closures"]
)

app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])

app.include_router(
    auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["authentication"]
)

# Add OpenLR router if exists
try:
    from app.api import openlr

    app.include_router(
        openlr.router, prefix=f"{settings.API_V1_STR}/openlr", tags=["openlr"]
    )
    logger.info("OpenLR router included successfully")
except ImportError:
    logger.warning("OpenLR router not found, skipping...")

# Add Import router
try:
    from app.api import import_data

    app.include_router(
        import_data.router, prefix=f"{settings.API_V1_STR}/import", tags=["import"]
    )
    logger.info("Import router included successfully")
except ImportError:
    logger.warning("Import router not found, skipping...")

# Add Routing router
try:
    from app.api import routing

    app.include_router(
        routing.router, prefix=f"{settings.API_V1_STR}/routing", tags=["routing"]
    )
    logger.info("Routing router included successfully")
except ImportError:
    logger.warning("Routing router not found, skipping...")


# Custom OpenAPI schema with proper authentication
def custom_openapi():
    """
    Custom OpenAPI schema with proper OAuth2PasswordBearer authentication.
    """
    if app.openapi_schema:
        return app.openapi_schema

    # Create the detailed description with proper markdown formatting
    api_description = f"""{settings.DESCRIPTION}

## 🚀 Getting Started

1. **Register**: Create a user account using `/auth/register`
2. **Login**: Click the 🔒 **Authorize** button below and use OAuth2 login
3. **Explore**: Use any authenticated endpoint!

## 🔑 Authentication

This API uses **OAuth2 Password Bearer** authentication with JWT tokens.

## 🗺️ Features

- **🗄️ Geospatial Support**: Store and query road closures with PostGIS
- **📍 Multiple Geometry Types**: Support for both LineString (road segments) and Point (intersections/locations) closures
- **📍 OpenLR Integration**: Location referencing compatible with navigation systems (LineString only)
- **🔐 Secure Authentication**: OAuth2 + JWT tokens with user management
- **📊 Rich Querying**: Spatial, temporal, and type-based filtering

## 📋 Example Usage

**Create a LineString Closure:**
```json
{{
  "geometry": {{
    "type": "LineString", 
    "coordinates": [[-87.6298, 41.8781], [-87.6290, 41.8785]]
  }},
  "description": "Water main repair blocking eastbound traffic",
  "closure_type": "construction",
  "start_time": "2025-07-03T08:00:00Z",
  "end_time": "2025-07-03T18:00:00Z"
}}
```

**Create a Point Closure:**
```json
{{
  "geometry": {{
    "type": "Point",
    "coordinates": [-87.6201, 41.8902]
  }},
  "description": "Multi-car accident blocking southbound lanes",
  "closure_type": "accident",
  "start_time": "2025-08-13T15:30:00Z",
  "end_time": "2025-08-13T18:45:00Z"
}}
```

## 🔗 Quick Links

- **Health Check**: [/health](/health)
- **Database Admin**: http://localhost:8080
- **GitHub**: https://github.com/sosm/temporary-road-closures

---

**💡 Tip**: After authenticating with OAuth2, try creating a closure and then querying it with different filters!"""

    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=api_description,
        routes=app.routes,
    )

    # Enhanced contact and license info
    openapi_schema["info"]["contact"] = {
        "name": "OSM Road Closures API Support",
        "url": "https://github.com/sosm/temporary-road-closures",
        "email": "architrathod77@gmail.com",
    }

    openapi_schema["info"]["license"] = {
        "name": "GNU Affero General Public License v3.0",
        "url": "https://www.gnu.org/licenses/agpl-3.0.en.html",
    }

    # Add server information
    openapi_schema["servers"] = [
        {
            "url": "https://api.closures.osm.ch",
            "description": "Production server",
        },
        {"url": "http://localhost:8000", "description": "Development server"},
    ]

    # CORRECTED: Proper OAuth2PasswordBearer security scheme
    openapi_schema["components"]["securitySchemes"] = {
        "OAuth2PasswordBearer": {
            "type": "oauth2",
            "flows": {
                "password": {
                    "tokenUrl": f"{settings.API_V1_STR}/auth/login",
                    "scopes": {},
                }
            },
            "description": """**OAuth2 Password Bearer Authentication**

Enter your username and password to get authenticated.

Test credentials:
- Username: chicago_mapper  
- Password: SecurePass123""",
        },
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": """**HTTP Bearer Token Authentication** (Alternative)

For direct API calls, include:
Header: Authorization: Bearer <your_access_token>""",
        },
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": """**API Key Authentication** (Alternative to JWT)

Get your API key from /auth/me after login, then include:
Header: X-API-Key: osm_closures_<your_key>""",
        },
    }

    # CORRECTED: Include OAuth2PasswordBearer in global security
    openapi_schema["security"] = [
        {"OAuth2PasswordBearer": []},
        {"BearerAuth": []},
        {"ApiKeyAuth": []},
    ]

    # Add example schemas
    openapi_schema["components"]["examples"] = {
        "UserRegistration": {
            "summary": "User Registration Example",
            "value": {
                "username": "chicago_mapper",
                "email": "mapper@chicago.gov",
                "password": "SecurePass123",
                "full_name": "Chicago City Mapper",
            },
        },
        "UserLogin": {
            "summary": "User Login Example",
            "value": {"username": "chicago_mapper", "password": "SecurePass123"},
        },
        "ClosureExample": {
            "summary": "Construction Closure Example",
            "value": {
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-87.6298, 41.8781], [-87.6290, 41.8785]],
                },
                "description": "Water main repair blocking eastbound traffic on Madison Street",
                "closure_type": "construction",
                "start_time": "2025-07-03T08:00:00Z",
                "end_time": "2025-07-03T18:00:00Z",
                "source": "City of Chicago",
                "confidence_level": 9,
            },
        },
    }

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
