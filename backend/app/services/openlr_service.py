"""
OpenLR (Open Location Referencing) service for encoding and decoding location references.

Encoding is spec-compliant: raw geometry is map-matched against the road network
via Valhalla's ``trace_attributes`` to obtain the Functional Road Class, Form of
Way and bearing that the OpenLR spec requires, then serialised with the
``openlr`` package.

Because map matching depends on an external service, encoding is best-effort:
if Valhalla is unavailable or the geometry cannot be matched, ``encode_geometry``
returns ``None`` and the caller stores no code rather than failing.
"""

import asyncio
import logging
import math
from enum import Enum
from typing import Any, Dict, List, Optional

import anyio
import openlr
import requests

from app.config import settings
from app.core.exceptions import GeospatialException, OpenLRException
from app.services.openlr_translation import build_line_location_reference
from app.services.routing_filters import costing_for_transport_mode
from app.services.valhalla_trace_service import (
    ValhallaTraceService,
    create_valhalla_trace_service,
)

logger = logging.getLogger(__name__)


class OpenLRFormat(str, Enum):
    """OpenLR encoding formats."""

    BINARY = "binary"
    BASE64 = "base64"
    XML = "xml"


class OpenLRService:
    """
    Service for OpenLR encoding and decoding operations.
    """

    def __init__(self, trace_service: Optional[ValhallaTraceService] = None):
        """Initialize OpenLR service with configuration.

        Args:
            trace_service: Valhalla map-matching client. Defaults to one built
                from settings; injectable so tests can supply a stub.
        """
        self.enabled = settings.OPENLR_ENABLED
        self.format = OpenLRFormat.BASE64  # Default format
        self.map_version = getattr(settings, "OPENLR_MAP_VERSION", "latest")
        self.use_valhalla = getattr(settings, "OPENLR_USE_VALHALLA", True)
        self.trace_service = trace_service or create_valhalla_trace_service()

        logger.info(
            "OpenLR Service initialized - Enabled: %s, Valhalla matching: %s",
            self.enabled,
            self.use_valhalla,
        )

    def _map_match(self, coordinates: List[List[float]], costing: str = "auto"):
        """Bridge to the async trace service from this sync class.

        Uses anyio.from_thread when called via run_in_threadpool; falls back
        to asyncio.run for plain sync callers (scripts, tests, regeneration).
        If a loop is already running in this thread, map-matching is skipped
        and returns None rather than risking a deadlock.

        Args:
            coordinates: GeoJSON LineString coordinates, ``[[lon, lat], ...]``.
            costing: Valhalla costing model to match against.
        """
        coro_factory = lambda: self.trace_service.trace_attributes(
            coordinates, costing=costing
        )
        try:
            return anyio.from_thread.run(coro_factory)
        except RuntimeError:
            # Not running inside a worker thread spawned from an event loop.
            pass

        try:
            return asyncio.run(coro_factory())
        except RuntimeError as exc:
            # A loop is already running in *this* thread; encoding synchronously
            # here would deadlock, so degrade rather than block.
            logger.warning(
                "Cannot map-match from a running event loop thread: %s. "
                "Call create_closure via run_in_threadpool.",
                exc,
            )
            return None

    def encode_geometry(
        self, geometry: Dict[str, Any], transport_mode: str = "all"
    ) -> Optional[str]:
        """
        Encode a GeoJSON geometry to a spec-compliant OpenLR code.

        The geometry is map-matched against the road network to derive the
        Functional Road Class, Form of Way and bearing that OpenLR requires;
        those cannot be inferred from coordinates alone.

        Args:
            geometry: GeoJSON LineString geometry
            transport_mode: DB transport_mode of the closure, selecting the
                Valhalla costing to match against. Defaults to ``"all"``
                (i.e. ``auto``), preserving the historic behaviour for callers
                that have no mode to offer.

        Returns:
            str: base64 OpenLR code, or ``None`` if the location could not be
            map-matched (Valhalla down, geometry off-network, or matching
            disabled). Encoding is best-effort by design.

        Raises:
            GeospatialException: If the geometry itself is invalid
        """
        if not self.enabled:
            logger.warning("OpenLR encoding skipped - service disabled")
            return None

        # Validate first: a malformed geometry is the caller's error and is
        # worth raising, unlike a map-match miss which is merely unfortunate.
        self._validate_geometry(geometry)

        coordinates = geometry.get("coordinates", [])
        if len(coordinates) < 2:
            raise GeospatialException("LineString must have at least 2 coordinates")

        if not self.use_valhalla:
            logger.warning(
                "OpenLR encoding skipped - Valhalla map matching is disabled"
            )
            return None

        trace = self._map_match(
            coordinates, costing=costing_for_transport_mode(transport_mode)
        )
        if trace is None:
            logger.warning(
                "OpenLR encoding skipped - map matching returned no result for "
                "a %d-point geometry",
                len(coordinates),
            )
            return None

        try:
            reference = build_line_location_reference(
                coordinates,
                trace.edges,
                max_points=settings.OPENLR_MAX_POINTS,
            )
            return openlr.binary_encode(reference)
        except Exception as e:
            # Assembly/serialisation failures are logged and degraded rather
            # than raised, so a closure still saves without a code.
            logger.error("OpenLR encoding failed: %s", e)
            return None

    def decode_openlr(self, openlr_code: str) -> Optional[Dict[str, Any]]:
        """
        Decode an OpenLR code to its location reference points.

        Note: returns LRP anchor points, not the closure's road geometry.
        Reconstructing the road path requires a dereferencer this service
        doesn't implement.

        Args:
            openlr_code: OpenLR encoded string (base64)

        Returns:
            dict: GeoJSON LineString of the LRP anchors

        Raises:
            OpenLRException: If decoding fails
        """
        if not self.enabled or not openlr_code:
            return None

        try:
            reference = openlr.binary_decode(openlr_code)
            coordinates = [list(pair) for pair in openlr.get_lonlat_list(reference)]
            return {"type": "LineString", "coordinates": coordinates}

        except NotImplementedError as e:
            # Pre-rewrite codes used a custom 0x42 format, which the real
            # decoder reports as an unsupported version. Call that out plainly
            # so stale rows are easy to spot.
            logger.error("OpenLR decoding failed - legacy or unsupported code: %s", e)
            raise OpenLRException(f"Unsupported OpenLR code (legacy format?): {e}")
        except Exception as e:
            logger.error("OpenLR decoding failed: %s", e)
            if isinstance(e, OpenLRException):
                raise
            raise OpenLRException(f"Decoding failed: {str(e)}")

    def validate_openlr_code(self, openlr_code: str) -> bool:
        """
        Validate an OpenLR code format.

        Args:
            openlr_code: OpenLR code to validate

        Returns:
            bool: True if valid format
        """
        if not openlr_code:
            return False

        try:
            # Try to decode - if successful, it's valid. Legacy 0x42 codes fail
            # here, which is the intended signal that they need regenerating.
            result = self.decode_openlr(openlr_code)
            return result is not None
        except Exception:
            return False

    def encode_osm_way(
        self, way_id: int, start_node: int = None, end_node: int = None
    ) -> Optional[str]:
        """
        Encode an OSM way to OpenLR format via the same map-matched path as closures.

        Args:
            way_id: OSM way ID
            start_node: Optional start node ID
            end_node: Optional end node ID

        Returns:
            str: OpenLR encoded string, or None if map matching failed

        Raises:
            OpenLRException: If fetching the way geometry fails
        """
        if not self.enabled:
            return None

        try:
            # Fetch way geometry from OSM API
            geometry = self._fetch_osm_way_geometry(way_id, start_node, end_node)

            # Encode the geometry through the same map-matched path as closures.
            return self.encode_geometry(geometry)

        except Exception as e:
            logger.error(f"OSM way encoding failed: {e}")
            raise OpenLRException(f"OSM way encoding failed: {str(e)}")

    def test_encoding_roundtrip(
        self, geometry: Dict[str, Any], transport_mode: str = "all"
    ) -> Dict[str, Any]:
        """
        Encode then decode a geometry and report how far the anchors moved.

        Accuracy is measured **endpoint to endpoint**, because decoding yields
        LRP anchors rather than the original vertex list (see ``decode_openlr``).
        A whole-line comparison would be meaningless.

        Args:
            geometry: GeoJSON geometry to test
            transport_mode: Must match the mode used for the encode being
                validated -- measuring accuracy against a different costing's
                map-match would compare two unrelated locations.

        Returns:
            dict: Test results with original, encoded, and decoded data
        """
        try:
            encoded = self.encode_geometry(geometry, transport_mode=transport_mode)
            decoded = self.decode_openlr(encoded) if encoded else None

            if not decoded:
                return {
                    "success": False,
                    "original_geometry": geometry,
                    "openlr_code": encoded,
                    "decoded_geometry": None,
                    "accuracy_meters": float("inf"),
                    "valid": False,
                }

            accuracy = self._calculate_geometry_accuracy(geometry, decoded)

            return {
                "success": True,
                "original_geometry": geometry,
                "openlr_code": encoded,
                "decoded_geometry": decoded,
                "accuracy_meters": accuracy,
                "valid": accuracy < settings.OPENLR_ACCURACY_TOLERANCE,
            }

        except Exception as e:
            return {"success": False, "error": str(e), "original_geometry": geometry}

    def _validate_geometry(self, geometry: Dict[str, Any]) -> None:
        """Validate GeoJSON geometry for OpenLR encoding."""
        if not isinstance(geometry, dict):
            raise GeospatialException("Geometry must be a dictionary")

        if "type" not in geometry or "coordinates" not in geometry:
            raise GeospatialException(
                "Geometry must have 'type' and 'coordinates' fields"
            )

        geometry_type = geometry["type"]
        if geometry_type not in ["LineString", "Point"]:
            raise GeospatialException(f"Unsupported geometry type: {geometry_type}")

        coordinates = geometry["coordinates"]

        if geometry_type == "Point":
            # OpenLR doesn't typically encode points, but we can validate the format
            if not isinstance(coordinates, list) or len(coordinates) != 2:
                raise GeospatialException("Point must have exactly 2 coordinates")
            return  # Skip further validation for points

        if geometry_type == "LineString":
            if len(coordinates) < 2:
                raise GeospatialException("LineString must have at least 2 coordinates")

            # Check for minimum distance between points
            if settings.OPENLR_MIN_DISTANCE > 0:
                for i in range(len(coordinates) - 1):
                    distance = self._calculate_haversine_distance(
                        coordinates[i], coordinates[i + 1]
                    )
                    if distance < settings.OPENLR_MIN_DISTANCE:
                        logger.warning(
                            f"Points {i} and {i + 1} are closer than minimum distance ({distance}m < {settings.OPENLR_MIN_DISTANCE}m)"
                        )

            for coord in coordinates:
                if not isinstance(coord, list) or len(coord) != 2:
                    raise GeospatialException(
                        "Each coordinate must be [longitude, latitude]"
                    )

                lon, lat = coord
                if not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
                    raise GeospatialException(f"Invalid coordinates: [{lon}, {lat}]")

    def _fetch_osm_way_geometry(
        self, way_id: int, start_node: int = None, end_node: int = None
    ) -> Dict[str, Any]:
        """Fetch OSM way geometry from Overpass API."""
        overpass_url = "https://overpass-api.de/api/interpreter"

        query = f"""
        [out:json];
        (
          way({way_id});
        );
        (._;>;);
        out geom;
        """

        try:
            response = requests.post(overpass_url, data=query, timeout=10)
            response.raise_for_status()

            data = response.json()

            # Extract way geometry
            way_element = None
            nodes = {}

            for element in data.get("elements", []):
                if element["type"] == "node":
                    nodes[element["id"]] = [element["lon"], element["lat"]]
                elif element["type"] == "way" and element["id"] == way_id:
                    way_element = element

            if not way_element:
                raise OpenLRException(f"OSM way {way_id} not found")

            # Build coordinate array
            coordinates = []
            node_ids = way_element.get("nodes", [])

            # Handle start/end node filtering
            if start_node:
                try:
                    start_idx = node_ids.index(start_node)
                    node_ids = node_ids[start_idx:]
                except ValueError:
                    logger.warning(f"Start node {start_node} not found in way {way_id}")

            if end_node:
                try:
                    end_idx = node_ids.index(end_node)
                    node_ids = node_ids[: end_idx + 1]
                except ValueError:
                    logger.warning(f"End node {end_node} not found in way {way_id}")

            for node_id in node_ids:
                if node_id in nodes:
                    coordinates.append(nodes[node_id])

            if len(coordinates) < 2:
                raise OpenLRException(f"Insufficient coordinates for way {way_id}")

            return {"type": "LineString", "coordinates": coordinates}

        except requests.RequestException as e:
            raise OpenLRException(f"Failed to fetch OSM data: {e}")

    def _calculate_geometry_accuracy(
        self, original: Dict[str, Any], decoded: Dict[str, Any]
    ) -> float:
        """Worst endpoint displacement, in metres, between two geometries.

        Compared endpoint-to-endpoint rather than vertex-by-vertex: decoding an
        OpenLR code yields LRP anchors, so the two coordinate lists have
        different lengths and no per-index correspondence. The endpoints are the
        only points both representations are guaranteed to share.
        """
        if not original or not decoded:
            return float("inf")

        orig_coords = original.get("coordinates", [])
        dec_coords = decoded.get("coordinates", [])

        if not orig_coords or not dec_coords:
            return float("inf")

        start_error = self._calculate_haversine_distance(orig_coords[0], dec_coords[0])
        end_error = self._calculate_haversine_distance(orig_coords[-1], dec_coords[-1])

        return max(start_error, end_error)

    def _calculate_haversine_distance(
        self, point1: List[float], point2: List[float]
    ) -> float:
        """Calculate distance between two points in meters using Haversine formula."""
        R = 6371000  # Earth radius in meters

        lat1, lon1 = math.radians(point1[1]), math.radians(point1[0])
        lat2, lon2 = math.radians(point2[1]), math.radians(point2[0])

        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c


# Factory function for creating OpenLR service
def create_openlr_service(
    trace_service: Optional[ValhallaTraceService] = None,
) -> OpenLRService:
    """Create and configure OpenLR service."""
    return OpenLRService(trace_service=trace_service)


# Utility functions for external use
def encode_coordinates_to_openlr(coordinates: List[List[float]]) -> Optional[str]:
    """
    Utility function to encode coordinates directly to OpenLR.

    Args:
        coordinates: List of [longitude, latitude] pairs

    Returns:
        str: OpenLR encoded string
    """
    service = create_openlr_service()
    geometry = {"type": "LineString", "coordinates": coordinates}
    return service.encode_geometry(geometry)


def decode_openlr_to_coordinates(openlr_code: str) -> Optional[List[List[float]]]:
    """
    Utility function to decode OpenLR directly to coordinates.

    Args:
        openlr_code: OpenLR encoded string

    Returns:
        list: List of [longitude, latitude] pairs
    """
    service = create_openlr_service()
    geometry = service.decode_openlr(openlr_code)
    return geometry.get("coordinates") if geometry else None
