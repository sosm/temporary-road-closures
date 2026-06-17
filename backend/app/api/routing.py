"""
API endpoint for closure-aware routing.

Fetches active closures relevant to the requested transportation mode, buffers
them into avoidance polygons, and asks Valhalla for a route that excludes them.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.models.user import User
from app.schemas.routing import RouteRequest, RouteResponse
from app.services.closure_service import ClosureService
from app.services.routing_service import RoutingError, get_route_with_closures
from app.services.spatial_service import SpatialService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/closure-aware",
    response_model=RouteResponse,
    summary="Closure-aware route",
    description=(
        "Compute a Valhalla route that avoids currently-active road closures "
        "relevant to the requested transportation mode.\n\n"
        "Unlike calling Valhalla directly, this endpoint injects active "
        "closures as `exclude_polygons` server-side, so the returned route "
        "detours around them. See `docs/CLOSURE_AWARE_ROUTING.md` for the full "
        "guide (buffer rules, limitations, error codes)."
    ),
)
async def closure_aware_route(
    request: RouteRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Route from ``start`` to ``end`` while avoiding active closures.

    **Parameters:**
    - **start** / **end**: GeoJSON Point geometries (``[lon, lat]``).
    - **mode**: ``auto`` | ``bicycle`` | ``pedestrian`` (Valhalla costing model).

    **Behaviour:**
    1. Queries currently-active closures that affect the chosen mode.
    2. Buffers each into a metric-correct avoidance polygon
       (LineString 10m, Point 15m; Polygon/MultiPolygon used as-is).
    3. Sends them to Valhalla as ``exclude_polygons``.

    **Returns:** Valhalla's trip object plus the number of excluded closures.

    **Error codes:**
    - ``400`` — invalid routing request (e.g. unroutable input points).
    - ``404`` — no route exists between the selected points.
    - ``500`` — unexpected server error while building the route.
    - ``502`` — Valhalla returned a 5xx upstream error.
    - ``503`` — Valhalla is unreachable (connection/transport error).
    - ``504`` — the routing request to Valhalla timed out.

    """
    closure_service = ClosureService(db)
    spatial_service = SpatialService(db)

    try:
        trip, excluded = await get_route_with_closures(
            start=request.start,
            end=request.end,
            mode=request.mode,
            closure_service=closure_service,
            spatial_service=spatial_service,
        )
    except RoutingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Closure-aware routing failed")
        raise HTTPException(
            status_code=500, detail=f"Routing failed: {str(exc)}"
        )

    return RouteResponse(trip=trip, excluded_closures=excluded)
