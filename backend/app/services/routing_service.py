"""
Closure-aware routing service.

Fetches active closures for the requested mode, buffers them into avoidance
polygons, and sends them to Valhalla as exclude_polygons.
"""

import logging
from typing import Any, Dict, List, Tuple

import httpx

from app.config import settings
from app.schemas.closure import GeoJSONGeometry
from app.schemas.routing import RoutingMode
from app.services.closure_service import ClosureService
from app.services.spatial_service import SpatialService

logger = logging.getLogger(__name__)


class RoutingError(Exception):
    """Raised when routing fails. ``status_code`` is the HTTP status the API
    layer should surface; ``message`` is a user-safe description."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


def _point_to_location(point: GeoJSONGeometry) -> Dict[str, float]:
    """GeoJSON Point ``[lon, lat]`` -> Valhalla location ``{lat, lon}``.

    GeoJSON is lon-first; Valhalla locations are lat/lon keyed. The
    ``RouteRequest`` validator already guarantees these are Points.
    """
    lon, lat = point.coordinates
    return {"lat": lat, "lon": lon, "type": "break"}


def _exclude_polygons_from_closures(
    closures: List[Dict[str, Any]], spatial_service: SpatialService
) -> List[List[List[float]]]:
    """Buffer each closure and collect outer rings as Valhalla
    ``exclude_polygons`` (a list of ``[[lon, lat], ...]`` rings).

    GeoJSON Polygon coordinates are ``[ring][point][lon, lat]`` and lon-first,
    which is exactly Valhalla's expected ordering, so we pass the outer ring
    through unchanged. A single bad geometry is logged and skipped rather than
    failing the whole route.
    """
    polygons: List[List[List[float]]] = []
    for closure in closures:
        try:
            buffered = spatial_service.buffer_closure(closure["geometry"])
        except Exception:  # noqa: BLE001 - one bad geom must not kill the route
            logger.exception(
                "Failed to buffer closure %s; skipping", closure.get("id")
            )
            continue

        if not buffered:
            # Unsupported geometry type (buffer_closure returned None).
            continue

        geom_type = buffered.get("type")
        coords = buffered.get("coordinates") or []
        if geom_type == "Polygon" and coords:
            # Outer ring only.
            polygons.append(coords[0])
        elif geom_type == "MultiPolygon":
            for poly in coords:
                if poly:
                    polygons.append(poly[0])

    return polygons


async def get_route_with_closures(
    start: GeoJSONGeometry,
    end: GeoJSONGeometry,
    mode: RoutingMode,
    closure_service: ClosureService,
    spatial_service: SpatialService,
) -> Tuple[Dict[str, Any], int]:
    """Compute a Valhalla route that avoids active closures for ``mode``.

    Returns ``(valhalla_json, excluded_closures_count)``.

    Raises ``RoutingError`` with an appropriate HTTP status on failure.
    """
    closures = closure_service.get_active_closures_for_mode(mode)
    exclude_polygons = _exclude_polygons_from_closures(closures, spatial_service)

    body: Dict[str, Any] = {
        "locations": [_point_to_location(start), _point_to_location(end)],
        "costing": mode.value,
        "directions_options": {"units": "kilometers"},
    }
    if exclude_polygons:
        body["exclude_polygons"] = exclude_polygons

    url = f"{settings.VALHALLA_URL.rstrip('/')}/route"

    try:
        async with httpx.AsyncClient(
            timeout=settings.VALHALLA_TIMEOUT_SECONDS
        ) as client:
            response = await client.post(url, json=body)
    except httpx.TimeoutException as exc:
        logger.warning("Valhalla request timed out: %s", exc)
        raise RoutingError(504, "Routing request timed out. Please try again.")
    except httpx.HTTPError as exc:
        logger.warning("Valhalla request failed: %s", exc)
        raise RoutingError(503, "Routing service is temporarily unavailable.")

    if response.status_code == 400:
        logger.info("Valhalla rejected route request: %s", response.text)
        raise RoutingError(
            400, "Invalid routing request. Please check your selected points."
        )
    if response.status_code == 404:
        raise RoutingError(404, "No route found between the selected points.")
    if response.status_code >= 500:
        logger.warning(
            "Valhalla upstream error %s: %s", response.status_code, response.text
        )
        raise RoutingError(502, "Routing service is temporarily unavailable.")

    return response.json().get("trip", response.json()), len(exclude_polygons)
