"""
Unit tests for metric-correct closure buffering at Swiss latitudes (~47N).

The key risk this guards against: buffering EPSG:4326 geometry by a raw value
treats the radius as *degrees*, not metres. These tests assert the produced
avoidance polygon has the expected size in true metres, which only holds if the
per-centroid UTM reprojection is correct.
"""

import math

import pytest

shapely = pytest.importorskip("shapely")
pytest.importorskip("pyproj")

from pyproj import Geod
from shapely.geometry import shape

from app.services.spatial_service import SpatialService

_GEOD = Geod(ellps="WGS84")

# Zurich-ish, ~47N 8E.
LAT = 47.3769
LON = 8.5417


def _svc():
    return SpatialService(db=None)


def _max_geodesic_extent(polygon) -> float:
    """North-south extent of a polygon's bounding box, in metres."""
    min_lon, min_lat, max_lon, max_lat = polygon.bounds
    mid_lon = (min_lon + max_lon) / 2
    _, _, ns_m = _GEOD.inv(mid_lon, min_lat, mid_lon, max_lat)
    return ns_m


def test_linestring_buffer_width_is_about_20m():
    # An east-west line; its buffer's north-south extent should be ~2 * 10m.
    geojson = {
        "type": "LineString",
        "coordinates": [[LON, LAT], [LON + 0.002, LAT]],
    }
    result = _svc().buffer_closure(geojson, line_m=10.0)
    assert result["type"] in ("Polygon", "MultiPolygon")

    ns_width = _max_geodesic_extent(shape(result))
    assert ns_width == pytest.approx(20.0, abs=1.0), ns_width


def test_point_buffer_diameter_is_about_30m():
    geojson = {"type": "Point", "coordinates": [LON, LAT]}
    result = _svc().buffer_closure(geojson, point_m=15.0)

    poly = shape(result)
    diameter = _max_geodesic_extent(poly)
    assert diameter == pytest.approx(30.0, abs=1.0), diameter


def test_polygon_passes_through_unchanged():
    ring = [
        [LON, LAT],
        [LON + 0.001, LAT],
        [LON + 0.001, LAT + 0.001],
        [LON, LAT + 0.001],
        [LON, LAT],
    ]
    geojson = {"type": "Polygon", "coordinates": [ring]}
    assert _svc().buffer_closure(geojson) == geojson


def test_unsupported_geometry_returns_none():
    geojson = {"type": "MultiLineString", "coordinates": [[[LON, LAT], [LON, LAT]]]}
    assert _svc().buffer_closure(geojson) is None


def test_buffer_is_not_in_degrees():
    # Regression guard: a degrees-based buffer of 10 would be ~1000km wide.
    geojson = {
        "type": "LineString",
        "coordinates": [[LON, LAT], [LON + 0.002, LAT]],
    }
    result = _svc().buffer_closure(geojson, line_m=10.0)
    ns_width = _max_geodesic_extent(shape(result))
    assert ns_width < 1000  # metres, not the ~2.2e6 a degrees bug would give
