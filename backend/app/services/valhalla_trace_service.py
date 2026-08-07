"""
Valhalla map-matching (``trace_attributes``) client.

Snaps a raw GeoJSON LineString onto the road network and returns the matched
edges' attributes -- road class, form-of-way inputs, bearing and length -- which
are the inputs required to build a spec-compliant OpenLR location reference.

Every failure path returns ``None`` rather than raising: OpenLR encoding is
best-effort, and a Valhalla outage must never block closure creation.
"""

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Attributes requested from Valhalla. Keep this list minimal -- trace_attributes
# returns one entry per matched edge and the response grows quickly.
_TRACE_FILTERS = [
    "edge.road_class",
    "edge.use",
    "edge.begin_heading",
    "edge.end_heading",
    "edge.length",
    "edge.way_id",
    "matched.point",
    "matched.type",
    "matched.edge_index",
]


@dataclass(frozen=True)
class MatchedEdge:
    """One road-network edge returned by ``trace_attributes``.

    ``length_m`` is metres. Valhalla reports edge ``length`` in **kilometres**
    regardless of the request's ``units`` field (verified against Valhalla
    3.5.1), so the conversion happens here, once, at the boundary.
    """

    road_class: str
    use: str
    begin_heading: float
    end_heading: float
    length_m: float
    way_id: Optional[int] = None


@dataclass(frozen=True)
class TraceResult:
    """Map-matched path: the matched edges plus the snapped shape."""

    edges: List[MatchedEdge]
    shape: Optional[str] = None

    @property
    def total_length_m(self) -> float:
        return sum(edge.length_m for edge in self.edges)


def _coordinates_to_shape(coordinates: List[List[float]]) -> List[Dict[str, float]]:
    """GeoJSON ``[[lon, lat], ...]`` -> Valhalla ``[{lat, lon}, ...]``.

    GeoJSON is lon-first; Valhalla shape points are lat/lon keyed. Any extra
    ordinates (elevation) are ignored.
    """
    return [{"lat": coord[1], "lon": coord[0]} for coord in coordinates]


def _parse_edges(payload: Dict[str, Any]) -> List[MatchedEdge]:
    """Build ``MatchedEdge`` objects, skipping any that are malformed.

    A single unparseable edge should not discard an otherwise usable match, so
    each is converted defensively.
    """
    edges: List[MatchedEdge] = []
    for raw in payload.get("edges") or []:
        if not isinstance(raw, dict):
            continue
        try:
            edges.append(
                MatchedEdge(
                    road_class=str(raw.get("road_class") or ""),
                    use=str(raw.get("use") or ""),
                    begin_heading=float(raw.get("begin_heading") or 0.0),
                    end_heading=float(raw.get("end_heading") or 0.0),
                    # km -> m
                    length_m=float(raw.get("length") or 0.0) * 1000.0,
                    way_id=raw.get("way_id"),
                )
            )
        except (TypeError, ValueError):
            logger.debug("Skipping malformed trace_attributes edge: %r", raw)
            continue
    return edges


class ValhallaTraceService:
    """Async client for Valhalla's ``trace_attributes`` endpoint."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        self.base_url = (base_url or settings.VALHALLA_URL).rstrip("/")
        self.timeout = (
            timeout if timeout is not None else settings.VALHALLA_TIMEOUT_SECONDS
        )

    async def trace_attributes(
        self,
        coordinates: List[List[float]],
        costing: str = "auto",
    ) -> Optional[TraceResult]:
        """Map-match ``coordinates`` onto the road network.

        Args:
            coordinates: GeoJSON LineString coordinates, ``[[lon, lat], ...]``.
            costing: Valhalla costing model (``auto``, ``bicycle``, ...).

        Returns:
            A ``TraceResult``, or ``None`` if the match failed for any reason.
        """
        if not coordinates or len(coordinates) < 2:
            logger.warning(
                "trace_attributes needs at least 2 coordinates, got %d",
                len(coordinates or []),
            )
            return None

        body = {
            "shape": _coordinates_to_shape(coordinates),
            "costing": costing,
            # map_snap lets Valhalla snap noisy input onto the network, which is
            # what we want for user-drawn closure geometry.
            "shape_match": "map_snap",
            "filters": {"attributes": _TRACE_FILTERS, "action": "include"},
        }

        url = f"{self.base_url}/trace_attributes"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=body)
        except httpx.TimeoutException as exc:
            logger.warning("Valhalla trace_attributes timed out: %s", exc)
            return None
        except httpx.HTTPError as exc:
            logger.warning("Valhalla trace_attributes request failed: %s", exc)
            return None

        if response.status_code != 200:
            # 400 here usually means "no match found" for the given shape, which
            # is an expected outcome for off-network geometry, not an error.
            logger.warning(
                "Valhalla trace_attributes returned %s: %s",
                response.status_code,
                response.text[:200],
            )
            return None

        try:
            payload = response.json()
        except ValueError as exc:
            logger.warning("Valhalla trace_attributes returned invalid JSON: %s", exc)
            return None

        if not isinstance(payload, dict):
            logger.warning(
                "Valhalla trace_attributes returned unexpected payload type: %s",
                type(payload).__name__,
            )
            return None

        edges = _parse_edges(payload)
        if not edges:
            logger.warning("Valhalla trace_attributes returned no usable edges")
            return None

        shape = payload.get("shape")
        return TraceResult(edges=edges, shape=shape if isinstance(shape, str) else None)


def create_valhalla_trace_service() -> ValhallaTraceService:
    """Factory mirroring ``create_openlr_service`` for consistent construction."""
    return ValhallaTraceService()
