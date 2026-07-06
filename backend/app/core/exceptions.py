"""
Custom exception classes for the OSM Road Closures API.
"""

from typing import Any, Dict, Optional, List
from fastapi import HTTPException, status


class APIException(Exception):
    """
    Base exception class for API-specific errors.
    """

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: str = "api_error",
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationException(APIException):
    """
    Exception for validation errors.
    """

    def __init__(
        self,
        message: str = "Validation failed",
        errors: Optional[List[Dict[str, Any]]] = None,
    ):
        self.errors = errors or []
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="validation_error",
            details={"errors": self.errors},
        )


class AuthenticationException(APIException):
    """
    Exception for authentication errors.
    """

    def __init__(
        self,
        message: str = "Authentication failed",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="authentication_error",
            details=details,
        )


class AuthorizationException(APIException):
    """
    Exception for authorization errors.
    """

    def __init__(
        self,
        message: str = "Insufficient permissions",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="authorization_error",
            details=details,
        )


class NotFoundException(APIException):
    """
    Exception for resource not found errors.
    """

    def __init__(
        self,
        resource: str = "Resource",
        resource_id: Optional[Any] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        message = f"{resource} not found"
        if resource_id:
            message += f" (ID: {resource_id})"

        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="not_found",
            details=details,
        )


class ConflictException(APIException):
    """
    Exception for resource conflict errors.
    """

    def __init__(
        self,
        message: str = "Resource conflict",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            error_code="conflict_error",
            details=details,
        )


class RateLimitException(APIException):
    """
    Exception for rate limit exceeded errors.
    """

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        if retry_after:
            details = details or {}
            details["retry_after"] = retry_after

        super().__init__(
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="rate_limit_exceeded",
            details=details,
        )


class GeospatialException(APIException):
    """
    Exception for geospatial operation errors.
    """

    def __init__(
        self,
        message: str = "Geospatial operation failed",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="geospatial_error",
            details=details,
        )


class OpenLRException(APIException):
    """
    Exception for OpenLR encoding/decoding errors.
    """

    def __init__(
        self,
        message: str = "OpenLR operation failed",
        operation: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        if operation:
            message = f"OpenLR {operation} failed"

        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="openlr_error",
            details=details,
        )


class DatabaseException(APIException):
    """
    Exception for database operation errors.
    """

    def __init__(
        self,
        message: str = "Database operation failed",
        operation: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        if operation:
            message = f"Database {operation} failed"

        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="database_error",
            details=details,
        )


class ExternalServiceException(APIException):
    """
    Exception for external service errors.
    """

    def __init__(
        self,
        service: str,
        message: str = "External service error",
        details: Optional[Dict[str, Any]] = None,
    ):
        message = f"{service} service error: {message}"

        super().__init__(
            message=message,
            status_code=status.HTTP_502_BAD_GATEWAY,
            error_code="external_service_error",
            details=details,
        )


# Convenience functions for common exceptions
def raise_not_found(resource: str = "Resource", resource_id: Optional[Any] = None):
    """Raise a NotFoundException."""
    raise NotFoundException(resource=resource, resource_id=resource_id)


def raise_forbidden(message: str = "Insufficient permissions"):
    """Raise an AuthorizationException."""
    raise AuthorizationException(message=message)


def raise_unauthorized(message: str = "Authentication required"):
    """Raise an AuthenticationException."""
    raise AuthenticationException(message=message)


def raise_validation_error(message: str, errors: Optional[List[Dict[str, Any]]] = None):
    """Raise a ValidationException."""
    raise ValidationException(message=message, errors=errors)


def raise_conflict(message: str = "Resource conflict"):
    """Raise a ConflictException."""
    raise ConflictException(message=message)
