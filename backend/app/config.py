"""
Application configuration using Pydantic settings with enhanced OpenLR support.
"""

from pydantic_settings import BaseSettings
from typing import Optional, List, Dict, Any
import os


class Settings(BaseSettings):
    """Application settings."""

    # Application
    PROJECT_NAME: str = "OSM Road Closures API"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "API for managing temporary road closures in OpenStreetMap"

    # Environment
    ENVIRONMENT: str = "development"

    # API Configuration
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/osm_closures"

    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"

    # Database connection pool settings
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 300

    # Security
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # CORS
    ALLOWED_HOSTS: List[str] = ["*"]
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",  # React development server
        "http://localhost:8080",  # Alternative frontend port
        "https://closures.osm.ch",
        "https://api.closures.osm.ch",
        "https://closures.osm.ch",
        "*",
    ]

    # Pagination defaults
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 1000

    # Spatial query limits
    MAX_BBOX_AREA: float = 25.0  # Maximum bounding box area in square degrees (e.g., ~5° × 5° = ~555km × 555km at equator)

    # OpenLR Configuration
    OPENLR_ENABLED: bool = True
    OPENLR_MAP_VERSION: str = "latest"
    OPENLR_FORMAT: str = "base64"
    OPENLR_ACCURACY_TOLERANCE: float = 50.0
    OPENLR_MAX_POINTS: int = 15
    OPENLR_MIN_DISTANCE: float = 15.0
    OPENLR_ENABLE_CACHING: bool = True
    OPENLR_OVERPASS_URL: str = "https://overpass-api.de/api/interpreter"
    OPENLR_OSM_API_URL: str = "https://api.openstreetmap.org/api/0.6"
    OPENLR_TIMEOUT: int = 10
    OPENLR_VALIDATE_ROUNDTRIP: bool = True
    OPENLR_AUTO_SIMPLIFY: bool = True
    OPENLR_COORDINATE_PRECISION: int = 5

    # External services
    OSM_API_BASE_URL: str = "https://api.openstreetmap.org/api/0.6"
    NOMINATIM_API_URL: str = "https://nominatim.openstreetmap.org"

    # Valhalla routing engine
    VALHALLA_URL: str = "http://valhalla:8002"
    VALHALLA_TIMEOUT_SECONDS: float = 10.0

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 3600  # 1 hour in seconds

    # File upload limits (for future features)
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB

    # OAuth Configuration
    OAUTH_ENABLED: bool = True

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/oauth/google/callback"

    # GitHub OAuth
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/oauth/github/callback"

    # OpenStreetMap OAuth
    OSM_CLIENT_ID: Optional[str] = None
    OSM_CLIENT_SECRET: Optional[str] = None
    OSM_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/oauth/osm/callback"

    # OAuth URLs
    GOOGLE_OAUTH_URL: str = "https://accounts.google.com/o/oauth2/auth"
    GOOGLE_TOKEN_URL: str = "https://oauth2.googleapis.com/token"
    GOOGLE_USER_INFO_URL: str = "https://www.googleapis.com/oauth2/v1/userinfo"

    GITHUB_OAUTH_URL: str = "https://github.com/login/oauth/authorize"
    GITHUB_TOKEN_URL: str = "https://github.com/login/oauth/access_token"
    GITHUB_USER_INFO_URL: str = "https://api.github.com/user"

    OSM_OAUTH_URL: str = "https://www.openstreetmap.org/oauth2/authorize"
    OSM_TOKEN_URL: str = "https://www.openstreetmap.org/oauth2/token"
    OSM_USER_INFO_URL: str = "https://api.openstreetmap.org/api/0.6/user/details.json"

    # Frontend URLs for OAuth redirect
    FRONTEND_URL: str = "http://localhost:3000"
    OAUTH_SUCCESS_REDIRECT: str = "/closures"
    OAUTH_ERROR_REDIRECT: str = "/login?error=oauth_failed"

    # OAuth session configuration
    OAUTH_STATE_EXPIRE_MINUTES: int = 10

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # This allows extra environment variables

    def get_database_url(self) -> str:
        """Get database URL with proper formatting."""
        return self.DATABASE_URL

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.ENVIRONMENT.lower() in ["development", "dev"] or self.DEBUG

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.ENVIRONMENT.lower() == "production" and not self.DEBUG

    @property
    def openlr_settings(self) -> Dict[str, Any]:
        """Get OpenLR configuration settings."""
        return {
            "enabled": self.OPENLR_ENABLED,
            "format": self.OPENLR_FORMAT,
            "map_version": self.OPENLR_MAP_VERSION,
            "accuracy_tolerance": self.OPENLR_ACCURACY_TOLERANCE,
            "max_points": self.OPENLR_MAX_POINTS,
            "min_distance": self.OPENLR_MIN_DISTANCE,
            "enable_caching": self.OPENLR_ENABLE_CACHING,
            "validate_roundtrip": self.OPENLR_VALIDATE_ROUNDTRIP,
            "auto_simplify": self.OPENLR_AUTO_SIMPLIFY,
            "coordinate_precision": self.OPENLR_COORDINATE_PRECISION,
            "timeout": self.OPENLR_TIMEOUT,
        }


# Environment-specific configurations
class DevelopmentSettings(Settings):
    """Development environment settings."""

    DEBUG: bool = True
    LOG_LEVEL: str = "DEBUG"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/osm_closures_dev"
    ENVIRONMENT: str = "development"

    # More permissive OpenLR settings for development
    OPENLR_ACCURACY_TOLERANCE: float = 100.0  # meters
    OPENLR_VALIDATE_ROUNDTRIP: bool = True
    OPENLR_ENABLE_CACHING: bool = False  # Disable caching for easier testing


class ProductionSettings(Settings):
    """Production environment settings."""

    DEBUG: bool = False
    LOG_LEVEL: str = "WARNING"
    ALLOWED_HOSTS: List[str] = ["your-domain.com"]
    RATE_LIMIT_REQUESTS: int = 1000
    ENVIRONMENT: str = "production"

    # Stricter OpenLR settings for production
    OPENLR_ACCURACY_TOLERANCE: float = 25.0  # meters
    OPENLR_VALIDATE_ROUNDTRIP: bool = True
    OPENLR_ENABLE_CACHING: bool = True


class TestSettings(Settings):
    """Testing environment settings."""

    DEBUG: bool = True
    DATABASE_URL: str = (
        "postgresql://postgres:postgres@localhost:5432/osm_closures_test"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 5
    ENVIRONMENT: str = "test"

    # Disable OpenLR for faster tests unless specifically testing OpenLR
    OPENLR_ENABLED: bool = False
    OPENLR_VALIDATE_ROUNDTRIP: bool = False


def get_settings() -> Settings:
    """
    Get settings based on environment.
    """
    env = os.getenv("ENVIRONMENT", "development").lower()

    if env == "production":
        return ProductionSettings()
    elif env == "test":
        return TestSettings()
    else:
        return DevelopmentSettings()


# Use environment-specific settings
settings = get_settings()
