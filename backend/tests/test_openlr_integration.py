"""
Integration tests for the OpenLR encoding path inside ClosureService.

Covers the wiring rather than the codec: dependency injection of the trace
service, the OPENLR_USE_VALHALLA flag, the best-effort failure contract (a
closure still saves when map matching is unavailable), and the two result-
merging bugs fixed alongside it.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.closure import ClosureType, TransportMode
from app.schemas.closure import ClosureCreate, ClosureUpdate
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


# --- transport mode reaches Valhalla ----------------------------------------


def _chain_service(trace_result=TraceResult(edges=_EDGES)):
    """
    ClosureService with a *real* ``_map_match``, so ``trace_attributes`` is
    genuinely invoked and its costing can be asserted. The ``_service`` helper
    above stubs ``_map_match``, hiding exactly this hop.
    """
    trace_service = MagicMock()
    trace_service.trace_attributes = AsyncMock(return_value=trace_result)
    return ClosureService(db=MagicMock(), trace_service=trace_service)


def _costings_seen(service):
    """
    The distinct costings passed to Valhalla. This is a set because roundtrip
    validation re-encodes, so one logical encode makes several calls -- what
    matters is that they all agree on the mode.
    """
    calls = service.openlr_service.trace_service.trace_attributes.call_args_list
    assert calls, "expected at least one trace_attributes call"
    return {call.kwargs["costing"] for call in calls}


def test_closure_transport_mode_reaches_trace_attributes():
    service = _chain_service()
    service._encode_geometry_to_openlr(_LINE, "bicycle")
    assert _costings_seen(service) == {"bicycle"}


def test_create_closure_map_matches_with_the_closures_own_mode():
    """The full chain: create a bicycle closure, assert bicycle costing."""
    service = _chain_service()
    closure_data = ClosureCreate(
        description="Cycleway resurfacing",
        closure_type=ClosureType.MAINTENANCE,
        start_time=datetime(2026, 8, 10, 9, 0, tzinfo=timezone.utc),
        end_time=datetime(2026, 8, 10, 17, 0, tzinfo=timezone.utc),
        transport_mode=TransportMode.BICYCLE,
        geometry=_LINE,
    )

    service.create_closure(closure_data, user_id=1)

    assert _costings_seen(service) == {"bicycle"}


def test_update_closure_uses_the_new_transport_mode_not_the_old_one():
    """
    Regression: the geometry re-encode used to run before the incoming fields
    were applied, so a mode+geometry update matched against the *previous*
    mode. Changing foot -> bicycle must map-match as a bicycle.
    """
    service = _chain_service()
    closure = MagicMock()
    closure.transport_mode = "foot"
    service.get_closure_by_id = MagicMock(return_value=closure)
    service._can_edit_closure = MagicMock(return_value=True)

    service.update_closure(
        closure_id=1,
        closure_data=ClosureUpdate(
            geometry=_LINE, transport_mode=TransportMode.BICYCLE
        ),
        user=MagicMock(),
    )

    assert _costings_seen(service) == {"bicycle"}


def test_update_closure_keeps_the_existing_mode_when_only_geometry_changes():
    service = _chain_service()
    closure = MagicMock()
    closure.transport_mode = "foot"
    service.get_closure_by_id = MagicMock(return_value=closure)
    service._can_edit_closure = MagicMock(return_value=True)

    service.update_closure(
        closure_id=1,
        closure_data=ClosureUpdate(geometry=_LINE),
        user=MagicMock(),
    )

    assert _costings_seen(service) == {"pedestrian"}


def test_bicycle_closure_still_saves_when_matching_fails():
    """
    The best-effort contract holds with the new costing parameter: an
    unmatchable bicycle closure yields no code instead of an exception.
    """
    service = _chain_service(trace_result=None)
    closure_data = ClosureCreate(
        description="Off-network path",
        closure_type=ClosureType.MAINTENANCE,
        start_time=datetime(2026, 8, 10, 9, 0, tzinfo=timezone.utc),
        transport_mode=TransportMode.BICYCLE,
        geometry=_LINE,
    )

    closure = service.create_closure(closure_data, user_id=1)

    assert _costings_seen(service) == {"bicycle"}
    assert closure.openlr_code is None
    service.db.commit.assert_called_once()


def test_use_valhalla_is_exposed_in_openlr_settings():
    from app.config import settings

    assert "use_valhalla" in settings.openlr_settings
