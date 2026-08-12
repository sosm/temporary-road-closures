"""
Tests for the spec-compliant OpenLR service.

Valhalla is stubbed, so these run without a live tile server. They cover the
map-matched encode path, the LRP-anchor decode semantics, and the best-effort
degradation contract (encoding returns None rather than raising when matching
is unavailable).
"""

from unittest.mock import AsyncMock, MagicMock, patch

import openlr
import pytest

from app.core.exceptions import GeospatialException, OpenLRException
from app.services.openlr_service import OpenLRService
from app.services.valhalla_trace_service import MatchedEdge, TraceResult

_LINE = {
    "type": "LineString",
    "coordinates": [[8.5410, 47.3760], [8.5430, 47.3770], [8.5450, 47.3780]],
}

_EDGES = [
    MatchedEdge("residential", "road", 342.0, 342.0, 5.0, 1121964954),
    MatchedEdge("tertiary", "road", 85.0, 86.0, 30.0, 602621673),
]


def _service(trace_result=TraceResult(edges=_EDGES), use_valhalla=True):
    """Build a service whose map-match step returns a canned result."""
    service = OpenLRService(trace_service=MagicMock())
    service.use_valhalla = use_valhalla
    service._map_match = MagicMock(return_value=trace_result)
    return service


# --- encoding ---------------------------------------------------------------


def test_encode_produces_a_real_openlr_code():
    code = _service().encode_geometry(_LINE)
    assert code
    # The decisive check: an independent parse of the OpenLR binary format.
    decoded = openlr.binary_decode(code)
    assert len(decoded.points) >= 2


def test_encoded_code_is_not_the_legacy_format():
    """The old stub emitted base64 starting with a 0x42 marker byte."""
    import base64

    code = _service().encode_geometry(_LINE)
    assert base64.b64decode(code)[0] != 0x42


def test_encode_uses_map_matched_road_attributes():
    from openlr import FOW, FRC

    trace = TraceResult(edges=[MatchedEdge("motorway", "road", 42.0, 42.0, 500.0)])
    code = _service(trace_result=trace).encode_geometry(_LINE)

    first = openlr.binary_decode(code).points[0]
    assert first.frc == FRC.FRC0
    assert first.fow == FOW.MOTORWAY
    # Bearing survives the 11.25-degree quantisation to within one sector.
    assert min(abs(first.bear - 42), 360 - abs(first.bear - 42)) <= 6


def test_encode_returns_none_when_map_matching_fails():
    """A Valhalla outage degrades to no code, it does not raise."""
    assert _service(trace_result=None).encode_geometry(_LINE) is None


def test_encode_returns_none_when_valhalla_disabled():
    service = _service(use_valhalla=False)
    assert service.encode_geometry(_LINE) is None
    service._map_match.assert_not_called()


# --- transport mode selects the Valhalla costing -----------------------------


def _tracing_service(trace_result=TraceResult(edges=_EDGES)):
    """
    A service with a *real* ``_map_match``, so the costing actually reaches
    ``trace_attributes``. The other helper stubs ``_map_match`` out, which is
    exactly the boundary the mode->costing translation crosses.
    """
    trace_service = MagicMock()
    trace_service.trace_attributes = AsyncMock(return_value=trace_result)
    service = OpenLRService(trace_service=trace_service)
    service.use_valhalla = True
    return service


@pytest.mark.parametrize(
    ("transport_mode", "expected_costing"),
    [
        ("car", "auto"),
        ("hgv", "auto"),
        ("motorcycle", "auto"),
        ("bus", "auto"),
        ("emergency", "auto"),
        ("bicycle", "bicycle"),
        ("foot", "pedestrian"),
        ("all", "auto"),
        ("spaceship", "auto"),
    ],
)
def test_transport_mode_selects_the_costing(transport_mode, expected_costing):
    service = _tracing_service()
    service.encode_geometry(_LINE, transport_mode=transport_mode)
    assert (
        service.trace_service.trace_attributes.call_args.kwargs["costing"]
        == expected_costing
    )


def test_encode_defaults_to_auto_costing():
    """Callers with no mode to offer (encode_osm_way, POST /encode) keep auto."""
    service = _tracing_service()
    service.encode_geometry(_LINE)
    assert service.trace_service.trace_attributes.call_args.kwargs["costing"] == "auto"


def test_roundtrip_matches_with_the_same_costing_as_the_encode():
    """
    Accuracy must be measured against the same map-match the code came from;
    validating a pedestrian encode against an auto match compares two
    different locations.
    """
    service = _tracing_service()
    service.test_encoding_roundtrip(_LINE, transport_mode="foot")

    costings = {
        call.kwargs["costing"]
        for call in service.trace_service.trace_attributes.call_args_list
    }
    assert costings == {"pedestrian"}


def test_encode_returns_none_when_service_disabled():
    service = _service()
    service.enabled = False
    assert service.encode_geometry(_LINE) is None


def test_encode_still_raises_on_invalid_geometry():
    """Caller errors stay loud; only match failures degrade quietly."""
    service = _service()
    with pytest.raises(GeospatialException):
        service.encode_geometry({"type": "Polygon", "coordinates": []})
    with pytest.raises(GeospatialException):
        service.encode_geometry({"type": "LineString", "coordinates": [[8.54, 47.37]]})


def test_encode_respects_max_points_setting():
    long_line = {
        "type": "LineString",
        "coordinates": [[8.5410 + i * 0.0005, 47.3760] for i in range(40)],
    }
    with patch("app.services.openlr_service.settings") as mock_settings:
        mock_settings.OPENLR_MAX_POINTS = 6
        mock_settings.OPENLR_ACCURACY_TOLERANCE = 50.0
        mock_settings.OPENLR_MIN_DISTANCE = 15.0
        code = _service().encode_geometry(long_line)

    assert len(openlr.binary_decode(code).points) <= 6


def test_encode_handles_spans_beyond_the_dnp_ceiling():
    """>15 km segments must subdivide instead of raising inside the encoder."""
    long_span = {"type": "LineString", "coordinates": [[8.0, 47.0], [9.0, 47.0]]}
    assert _service().encode_geometry(long_span)


# --- decoding ---------------------------------------------------------------


def test_decode_returns_lrp_anchors():
    service = _service()
    code = service.encode_geometry(_LINE)
    decoded = service.decode_openlr(code)

    assert decoded["type"] == "LineString"
    # Endpoints are preserved to within coordinate quantisation (~0.3 m).
    assert abs(decoded["coordinates"][0][0] - 8.5410) < 1e-4
    assert abs(decoded["coordinates"][-1][0] - 8.5450) < 1e-4


def test_decode_rejects_legacy_codes_with_a_clear_message():
    """Pre-rewrite 0x42 codes must fail loudly so stale rows are detectable."""
    import base64
    import struct

    data = bytearray([0x42, 2])
    for lon, lat in [(8.541, 47.376), (8.545, 47.378)]:
        data.extend(struct.pack(">I", int((lon + 180) * 1000000)))
        data.extend(struct.pack(">I", int((lat + 90) * 1000000)))
    legacy = base64.b64encode(bytes(data)).decode("ascii")

    with pytest.raises(OpenLRException, match="legacy"):
        _service().decode_openlr(legacy)


def test_decode_returns_none_for_empty_input():
    assert _service().decode_openlr("") is None
    assert _service().decode_openlr(None) is None


def test_decode_raises_on_garbage():
    with pytest.raises(OpenLRException):
        _service().decode_openlr("!!!not-a-code!!!")


def test_validate_openlr_code():
    service = _service()
    code = service.encode_geometry(_LINE)
    assert service.validate_openlr_code(code) is True
    assert service.validate_openlr_code("garbage") is False
    assert service.validate_openlr_code("") is False


# --- roundtrip harness ------------------------------------------------------


def test_roundtrip_reports_endpoint_accuracy():
    result = _service().test_encoding_roundtrip(_LINE)
    assert result["success"] is True
    assert result["valid"] is True
    # Endpoint-to-endpoint error is coordinate quantisation only, well under 1 m.
    assert result["accuracy_meters"] < 1.0


def test_roundtrip_reports_failure_when_encoding_degrades():
    result = _service(trace_result=None).test_encoding_roundtrip(_LINE)
    assert result["success"] is False
    assert result["valid"] is False
    assert result["openlr_code"] is None


def test_accuracy_compares_endpoints_not_vertex_pairs():
    """Different-length coordinate lists must still yield a finite distance.

    The previous implementation returned inf whenever the lengths differed,
    which is always the case now that decoding yields LRP anchors.
    """
    service = _service()
    original = {
        "type": "LineString",
        "coordinates": [[8.54, 47.37], [8.545, 47.375], [8.55, 47.38]],
    }
    decoded = {"type": "LineString", "coordinates": [[8.54, 47.37], [8.55, 47.38]]}

    assert service._calculate_geometry_accuracy(original, decoded) < 1.0


# --- OSM way encoding -------------------------------------------------------


def test_encode_osm_way_uses_the_map_matched_encoder():
    """Overpass fetching is untouched; only the encoding path changed."""
    service = _service()
    service._fetch_osm_way_geometry = MagicMock(return_value=_LINE)

    code = service.encode_osm_way(way_id=12345)

    service._fetch_osm_way_geometry.assert_called_once_with(12345, None, None)
    service._map_match.assert_called_once()
    assert openlr.binary_decode(code)
