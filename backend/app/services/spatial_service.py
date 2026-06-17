"""
Spatial operations service.
"""

import json
import logging
from functools import lru_cache
from typing import Any, Dict, Optional

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform as shapely_transform

logger = logging.getLogger(__name__)

# Default avoidance-buffer radii (metres). Tunable via buffer_closure() args;
# 10 m / 15 m round-cap is the v1 baseline (see routing plan Step 4).
DEFAULT_LINE_BUFFER_M = 10.0
DEFAULT_POINT_BUFFER_M = 15.0
WGS84_EPSG = 4326


@lru_cache(maxsize=128)
def _utm_transformers(utm_epsg: int):
    """Cached (to_utm, to_wgs84) transformer pair for a UTM EPSG code."""
    to_utm = Transformer.from_crs(WGS84_EPSG, utm_epsg, always_xy=True)
    to_wgs84 = Transformer.from_crs(utm_epsg, WGS84_EPSG, always_xy=True)
    return to_utm, to_wgs84


def _utm_epsg_for(lon: float, lat: float) -> int:
    """
    EPSG code of the UTM zone containing (lon, lat).

    Derived per geometry rather than hardcoded: Switzerland straddles zones
    31N/32N, so a single zone is slightly wrong at the edges. Northern
    hemisphere -> 326xx, southern -> 327xx.
    """
    zone = int((lon + 180) / 6) + 1
    return (32600 if lat >= 0 else 32700) + zone


class SpatialService:
    def __init__(self, db):
        self.db = db

    def geojson_to_wkt(self, geojson):
        """Convert GeoJSON to WKT format for both Point and LineString."""
        geometry_type = geojson.get("type")
        coordinates = geojson.get("coordinates", [])
        
        if geometry_type == "Point":
            # Point: POINT(longitude latitude)
            lon, lat = coordinates
            return f"POINT({lon} {lat})"
        
        elif geometry_type == "LineString":
            # LineString: LINESTRING(lon1 lat1, lon2 lat2, ...)
            coord_pairs = [f"{lon} {lat}" for lon, lat in coordinates]
            return f"LINESTRING({', '.join(coord_pairs)})"

        return None

    def buffer_closure(
        self,
        geometry: Dict[str, Any],
        line_m: float = DEFAULT_LINE_BUFFER_M,
        point_m: float = DEFAULT_POINT_BUFFER_M,
        cap_style: str = "round",
    ) -> Optional[Dict[str, Any]]:
        """
        Buffer a closure geometry into an avoidance polygon (GeoJSON).

        - LineString -> buffered by ``line_m`` metres.
        - Point      -> buffered by ``point_m`` metres (logged).
        - Polygon / MultiPolygon -> passed through unchanged (already an area).

        Buffering is metric-correct: the geometry is reprojected from EPSG:4326
        (degrees) to the UTM zone of its own centroid, buffered, then reprojected
        back, so ``line_m`` / ``point_m`` are true metres anywhere on Earth.

        Radii and ``cap_style`` ("round" | "flat" | "square", per shapely 2.x)
        are parameters so the avoidance footprint can be tuned without code
        changes.

        Args:
            geometry: GeoJSON geometry dict (from ST_AsGeoJSON).
            line_m: Buffer radius for LineString geometries, in metres.
            point_m: Buffer radius for Point geometries, in metres.
            cap_style: shapely buffer cap style.

        Returns:
            GeoJSON Polygon/MultiPolygon dict, or ``None`` if the geometry type
            is unsupported.
        """
        geom_type = geometry.get("type")

        if geom_type in ("Polygon", "MultiPolygon"):
            # Already an area; use as-is.
            return geometry

        if geom_type == "Point":
            radius_m = point_m
            logger.info("Buffering Point closure by %sm", radius_m)
        elif geom_type == "LineString":
            radius_m = line_m
        else:
            logger.warning("Unsupported geometry type for buffering: %s", geom_type)
            return None

        geom = shape(geometry)

        # Per-centroid UTM zone keeps the buffer metric-accurate.
        centroid = geom.centroid
        utm_epsg = _utm_epsg_for(centroid.x, centroid.y)
        to_utm, to_wgs84 = _utm_transformers(utm_epsg)

        geom_utm = shapely_transform(to_utm.transform, geom)
        buffered_utm = geom_utm.buffer(radius_m, cap_style=cap_style)
        buffered = shapely_transform(to_wgs84.transform, buffered_utm)

        return mapping(buffered)
