"""
API endpoints for closure management.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import math

from app.core.database import get_db
from app.api.deps import (
    get_current_active_user,
    get_current_user_optional,
    get_current_moderator,
    get_pagination_params,
)
from app.models.user import User
from app.models.closure import ClosureType, ClosureStatus, TransportMode
from app.schemas.closure import (
    ClosureCreate,
    ClosureUpdate,
    ClosureResponse,
    ClosureListResponse,
    ClosureQueryParams,
    ClosureStatsResponse,
)
from app.services.closure_service import ClosureService
from app.core.exceptions import NotFoundException, ValidationException


router = APIRouter()


# Short client/proxy cache for map tiles. Closures are user-submitted and
# low-frequency; a 5-minute TTL absorbs pan/zoom re-requests without making a
# newly-added closure invisible for long. HTTP headers only (see PR discussion).
TILE_CACHE_CONTROL = "public, max-age=300"


@router.post(
    "/",
    response_model=ClosureResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new closure",
    description="Submit a new temporary road closure with geometry and metadata.",
)
async def create_closure(
    closure_data: ClosureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new closure.

    - **geometry**: GeoJSON LineString representing the closed road segment
    - **description**: Human-readable description of the closure
    - **closure_type**: Type of closure (construction, accident, event, etc.)
    - **start_time**: When the closure begins
    - **end_time**: When the closure ends (optional for indefinite closures)
    - **source**: Source of the closure information (optional)
    - **confidence_level**: Confidence in the information (1-10, optional)
    - **is_bidirectional**: Whether the closure affects both directions (default: false)

    Returns the created closure with generated ID and OpenLR code.
    """
    service = ClosureService(db)
    closure = service.create_closure(closure_data, current_user.id)

    # Get closure with geometry for response
    closure_dict = service.get_closure_with_geometry(closure.id)

    return ClosureResponse(**closure_dict)


@router.get(
    "/",
    response_model=ClosureListResponse,
    summary="Query closures",
    description="Query closures with spatial, temporal, and other filters.",
)
async def query_closures(
    bbox: Optional[str] = Query(
        None,
        description="Bounding box filter: 'min_lon,min_lat,max_lon,max_lat'. Maximum area: 25 sq degrees (e.g., 5° × 5°)",
        example="-87.7,41.8,-87.6,41.9",
    ),
    valid_only: bool = Query(True, description="Return only currently valid closures"),
    closure_type: Optional[ClosureType] = Query(
        None, description="Filter by closure type"
    ),
    transport_mode: Optional[TransportMode] = Query(
        None, description="Filter by transport mode affected"
    ),
    start_time: Optional[str] = Query(
        None, description="Filter closures starting after this time (ISO 8601)"
    ),
    end_time: Optional[str] = Query(
        None, description="Filter closures ending before this time (ISO 8601)"
    ),
    submitter_id: Optional[int] = Query(
        None, description="Filter by submitter user ID"
    ),
    is_bidirectional: Optional[bool] = Query(
        None,
        description="Filter by direction: true for bidirectional, false for unidirectional",
    ),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, le=1000, description="Page size"),
    validate_openlr: bool = Query(
        False,
        description="Validate OpenLR codes (expensive, disabled by default for performance)",
    ),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Query closures with various filters.

    **Spatial Filtering:**
    - Use `bbox` parameter to get closures within a geographic area
    - Format: "min_longitude,min_latitude,max_longitude,max_latitude"
    - Maximum bbox area: 25 square degrees (e.g., 5° × 5°, approximately 555km × 555km at equator)
    - For larger areas, split into multiple smaller queries

    **Temporal Filtering:**
    - `valid_only=true` (default): Only return currently valid closures
    - `start_time`: Filter closures that start after the specified time
    - `end_time`: Filter closures that end before the specified time

    **Direction Filtering:**
    - `is_bidirectional=true`: Return only closures that affect both directions
    - `is_bidirectional=false`: Return only closures that affect one direction
    - `is_bidirectional` not specified: Return closures regardless of direction

    **Other Filters:**
    - `closure_type`: Filter by type (construction, accident, event, etc.)
    - `submitter_id`: Get closures submitted by a specific user

    **Pagination:**
    - Use `page` and `size` parameters to paginate results
    - Maximum page size is 1000

    Returns paginated list of closures with metadata.
    """
    # Parse datetime strings if provided
    start_datetime = None
    end_datetime = None

    if start_time:
        try:
            from datetime import datetime

            start_datetime = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid start_time format. Use ISO 8601 format.",
            )

    if end_time:
        try:
            from datetime import datetime

            end_datetime = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid end_time format. Use ISO 8601 format.",
            )

    # Create query parameters
    query_params = ClosureQueryParams(
        bbox=bbox,
        valid_only=valid_only,
        closure_type=closure_type,
        transport_mode=transport_mode,
        start_time=start_datetime,
        end_time=end_datetime,
        submitter_id=submitter_id,
        is_bidirectional=is_bidirectional,
        page=page,
        size=size,
    )

    service = ClosureService(db)

    try:
        closures, total = service.query_closures(query_params, current_user)
    except ValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log the error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error querying closures: {e}")

        # Return a more user-friendly error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while querying closures. Please try a smaller bounding box or contact support."
        )

    # Convert closures to response format with geometry
    closure_dicts = service.get_closures_with_geometry(closures, validate_openlr=validate_openlr)
    closure_responses = [
        ClosureResponse(**closure_dict) for closure_dict in closure_dicts
    ]

    # Calculate pagination metadata
    pages = math.ceil(total / size) if total > 0 else 1

    return ClosureListResponse(
        items=closure_responses, total=total, page=page, size=size, pages=pages
    )


@router.get(
    "/tiles/{z}/{x}/{y}.mvt",
    summary="Closure vector tile (MVT)",
    description=(
        "Return closures intersecting tile (z, x, y) as a Mapbox Vector Tile. "
        "Used by the map for zoom-independent rendering; supports the same "
        "status/type/mode/temporal filters as GET /closures. Unlike the bbox "
        "query, there is no area limit — the tile bounds the extent."
    ),
    response_class=Response,
    responses={200: {"content": {"application/x-protobuf": {}}}},
)
async def get_closures_tile(
    z: int = Path(..., ge=0, le=24, description="Tile zoom level"),
    x: int = Path(..., ge=0, description="Tile column"),
    y: int = Path(..., ge=0, description="Tile row"),
    valid_only: bool = Query(True, description="Return only currently valid closures"),
    closure_type: Optional[ClosureType] = Query(
        None, description="Filter by closure type"
    ),
    transport_mode: Optional[TransportMode] = Query(
        None, description="Filter by transport mode affected"
    ),
    is_bidirectional: Optional[bool] = Query(
        None, description="Filter by direction"
    ),
    start_time: Optional[str] = Query(
        None, description="Filter closures starting after this time (ISO 8601)"
    ),
    end_time: Optional[str] = Query(
        None, description="Filter closures ending before this time (ISO 8601)"
    ),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Serve a single MVT tile of closures for the map layer.

    Filters mirror `query_closures` so map tiles and the GeoJSON list endpoint
    stay consistent. The response is a protobuf; an empty tile is returned with
    HTTP 204 (no content) so the client simply renders nothing there.
    """
    start_datetime = None
    end_datetime = None

    if start_time:
        try:
            from datetime import datetime

            start_datetime = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid start_time format. Use ISO 8601 format.",
            )

    if end_time:
        try:
            from datetime import datetime

            end_datetime = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid end_time format. Use ISO 8601 format.",
            )

    service = ClosureService(db)

    try:
        tile = service.get_closures_tile(
            z=z,
            x=x,
            y=y,
            valid_only=valid_only,
            closure_type=closure_type.value if closure_type else None,
            transport_mode=transport_mode.value if transport_mode else None,
            is_bidirectional=is_bidirectional,
            start_time=start_datetime,
            end_time=end_datetime,
        )
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Error rendering closure tile {z}/{x}/{y}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while rendering the map tile.",
        )

    if not tile:
        return Response(
            status_code=status.HTTP_204_NO_CONTENT,
            headers={"Cache-Control": TILE_CACHE_CONTROL},
        )

    return Response(
        content=tile,
        media_type="application/x-protobuf",
        headers={"Cache-Control": TILE_CACHE_CONTROL},
    )


@router.get(
    "/{closure_id}",
    response_model=ClosureResponse,
    summary="Get closure by ID",
    description="Get detailed information about a specific closure.",
)
async def get_closure(
    closure_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Get a specific closure by ID.

    Returns detailed closure information including:
    - Full geometry as GeoJSON
    - Metadata and timestamps
    - OpenLR location reference code
    - Current status and validity state
    - Direction information (bidirectional or unidirectional)
    """
    service = ClosureService(db)

    try:
        closure_dict = service.get_closure_with_geometry(closure_id)
        return ClosureResponse(**closure_dict)
    except NotFoundException:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Closure with ID {closure_id} not found",
        )


@router.put(
    "/{closure_id}",
    response_model=ClosureResponse,
    summary="Update closure",
    description="Update an existing closure. Only the submitter or moderators can edit.",
)
async def update_closure(
    closure_id: int,
    closure_data: ClosureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Update an existing closure.

    **Permissions:**
    - Users can update their own closures
    - Moderators can update any closure

    **Updatable Fields:**
    - Geometry (will regenerate OpenLR code)
    - Description and metadata
    - Start/end times
    - Status (for moderators)
    - Closure type
    - Direction (bidirectional flag)

    **Automatic Updates:**
    - `updated_at` timestamp is automatically set
    - OpenLR code is regenerated if geometry changes
    - Status may be automatically updated based on timing
    """
    service = ClosureService(db)

    try:
        closure = service.update_closure(closure_id, closure_data, current_user)
        closure_dict = service.get_closure_with_geometry(closure.id)
        return ClosureResponse(**closure_dict)
    except NotFoundException:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Closure with ID {closure_id} not found",
        )
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete(
    "/{closure_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete closure",
    description="Delete a closure. Only the submitter or moderators can delete.",
)
async def delete_closure(
    closure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete a closure.

    **Permissions:**
    - Users can delete their own closures
    - Moderators can delete any closure

    **Note:** This is a hard delete operation. The closure and all its data
    will be permanently removed from the database.
    """
    service = ClosureService(db)

    try:
        service.delete_closure(closure_id, current_user)
    except NotFoundException:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Closure with ID {closure_id} not found",
        )
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get(
    "/statistics/summary",
    response_model=ClosureStatsResponse,
    summary="Get closure statistics",
    description="Get statistical summary of closures in the system.",
)
async def get_closure_statistics(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Get statistical summary of closures.

    Returns:
    - Total number of closures
    - Number of currently valid closures
    - Breakdown by closure type
    - Breakdown by status
    - Average closure duration

    This endpoint can be used for dashboards and monitoring.
    """
    service = ClosureService(db)
    stats = service.get_statistics()

    return ClosureStatsResponse(**stats)


@router.get(
    "/user/{user_id}",
    response_model=ClosureListResponse,
    summary="Get user's closures",
    description="Get closures submitted by a specific user.",
)
async def get_user_closures(
    user_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, le=1000, description="Page size"),
    valid_only: bool = Query(False, description="Return only valid closures"),
    is_bidirectional: Optional[bool] = Query(
        None,
        description="Filter by direction: true for bidirectional, false for unidirectional",
    ),
    validate_openlr: bool = Query(
        False,
        description="Validate OpenLR codes (expensive, disabled by default for performance)",
    ),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Get closures submitted by a specific user.

    **Privacy:**
    - Anyone can view closures by user ID
    - User information is not included in the response

    **Filtering:**
    - Use `valid_only=true` to see only currently valid closures
    - Use `is_bidirectional=true/false` to filter by direction
    - Results are ordered by creation date (newest first)
    """
    query_params = ClosureQueryParams(
        submitter_id=user_id,
        valid_only=valid_only,
        is_bidirectional=is_bidirectional,
        page=page,
        size=size,
    )

    service = ClosureService(db)
    closures, total = service.query_closures(query_params, current_user)

    # Convert to response format
    closure_dicts = service.get_closures_with_geometry(closures, validate_openlr=validate_openlr)
    closure_responses = [
        ClosureResponse(**closure_dict) for closure_dict in closure_dicts
    ]

    pages = math.ceil(total / size) if total > 0 else 1

    return ClosureListResponse(
        items=closure_responses, total=total, page=page, size=size, pages=pages
    )


@router.post(
    "/{closure_id}/status",
    response_model=ClosureResponse,
    summary="Update closure status",
    description="Update the status of a closure (moderators only).",
)
async def update_closure_status(
    closure_id: int,
    new_status: ClosureStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_moderator),
):
    """
    Update closure status (moderators only).

    **Available Statuses:**
    - `active`: Closure is currently in effect
    - `expired`: Closure has ended naturally
    - `cancelled`: Closure was cancelled before completion
    - `planned`: Closure is scheduled for the future

    **Moderator Action:**
    This endpoint is restricted to moderators for status management.
    Regular users should use the general update endpoint.
    """
    service = ClosureService(db)

    try:
        # Create update object with just status
        update_data = ClosureUpdate(status=new_status)
        closure = service.update_closure(closure_id, update_data, current_user)

        closure_dict = service.get_closure_with_geometry(closure.id)
        return ClosureResponse(**closure_dict)
    except NotFoundException:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Closure with ID {closure_id} not found",
        )
