"""
Integration tests for the OpenLR encoding path inside ClosureService.

Covers the wiring rather than the codec: dependency injection of the trace
service, the OPENLR_USE_VALHALLA flag, the best-effort failure contract (a
closure still saves when map matching is unavailable), and the two result-
merging bugs fixed alongside it.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.services.closure_service import ClosureService
from app.services.valhalla_trace_service import MatchedEdge, TraceResult

_LINE = {
    "type": "LineString",
    "coordinates": [[8.5410, 47.3760], [8.5430, 47.3770], [8.5450, 47.3780]],
}

_EDGES = [MatchedEdge("residential", "road", 342.0, 342.0, 55.0, 1121964954)]


def _service(trace_result=TraceResult(edges=_EDGES)):
    """ClosureService whose OpenLR map-match step returns a canned result."""
    service = ClosureService(db=MagicMock(), trace_service=MagicMock())
    service.openlr_service._map_match = MagicMock(return_value=trace_result)
    return service


# --- dependency injection ---------------------------------------------------


def test_trace_service_is_injected_into_the_openlr_service():
    stub = MagicMock()
    service = ClosureService(db=MagicMock(), trace_service=stub)
    assert service.openlr_service.trace_service is stub


def test_default_construction_still_works():
    """Existing `ClosureService(db)` callers must keep working."""
    service = ClosureService(db=MagicMock())
    assert service.openlr_service.trace_service is not None


# --- happy path -------------------------------------------------------------


def test_encoding_succeeds_with_a_map_match():
    result = _service()._encode_geometry_to_openlr(_LINE)
    assert result["success"] is True
    assert result["openlr_code"]


def test_point_geometry_is_skipped_without_error():
    result = _service()._encode_geometry_to_openlr(
        {"type": "Point", "coordinates": [8.54, 47.37]}
    )
    assert result["success"] is True
    assert result["openlr_code"] is None


# --- best-effort degradation ------------------------------------------------


def test_map_match_failure_degrades_instead_of_raising():
    """A Valhalla outage must not fail closure creation."""
    result = _service(trace_result=None)._encode_geometry_to_openlr(_LINE)
    assert result["success"] is False
    assert result.get("openlr_code") is None
    assert "map matching" in result["error"]


def test_valhalla_flag_off_produces_no_code():
    service = _service()
    service.openlr_service.use_valhalla = False
    result = service._encode_geometry_to_openlr(_LINE)
    assert result["success"] is False
    assert result.get("openlr_code") is None


def test_invalid_geometry_is_reported_not_raised():
    """_encode_geometry_to_openlr converts caller errors into a result dict."""
    result = _service()._encode_geometry_to_openlr(
        {"type": "LineString", "coordinates": [[8.54, 47.37]]}
    )
    assert result["success"] is False
    assert "error" in result


# --- result merging (regression guards) -------------------------------------


def test_roundtrip_diagnostics_do_not_clobber_the_encode_result():
    """`result.update(roundtrip)` used to overwrite success and openlr_code."""
    service = _service()
    service.validate_roundtrip = True
    service.openlr_service.test_encoding_roundtrip = MagicMock(
        return_value={
            "success": False,  # must not leak into the merged result
            "openlr_code": "SOMETHING-ELSE",  # nor this
            "accuracy_meters": 0.3,
            "decoded_geometry": {"type": "LineString", "coordinates": []},
        }
    )

    result = service._encode_geometry_to_openlr(_LINE)

    assert result["success"] is True
    assert result["openlr_code"] != "SOMETHING-ELSE"
    # Diagnostics still come through.
    assert result["accuracy_meters"] == 0.3


def test_code_exceeding_accuracy_tolerance_is_rejected():
    """Previously only a warning was set and the bad code was persisted."""
    service = _service()
    service.validate_roundtrip = True
    service.openlr_service.test_encoding_roundtrip = MagicMock(
        return_value={"success": True, "accuracy_meters": 9999.0}
    )

    with patch("app.services.closure_service.settings") as mock_settings:
        mock_settings.OPENLR_ACCURACY_TOLERANCE = 50.0
        result = service._encode_geometry_to_openlr(_LINE)

    assert result["success"] is False
    assert "exceeds tolerance" in result["error"]


def test_accuracy_within_tolerance_is_accepted():
    service = _service()
    service.validate_roundtrip = True
    service.openlr_service.test_encoding_roundtrip = MagicMock(
        return_value={"success": True, "accuracy_meters": 0.31}
    )

    with patch("app.services.closure_service.settings") as mock_settings:
        mock_settings.OPENLR_ACCURACY_TOLERANCE = 50.0
        result = service._encode_geometry_to_openlr(_LINE)

    assert result["success"] is True
    assert result["openlr_code"]


# --- config flag ------------------------------------------------------------


def test_use_valhalla_setting_exists_and_defaults_on():
    from app.config import settings

    assert hasattr(settings, "OPENLR_USE_VALHALLA")
    assert settings.OPENLR_USE_VALHALLA is True


def test_use_valhalla_is_exposed_in_openlr_settings():
    from app.config import settings

    assert "use_valhalla" in settings.openlr_settings
