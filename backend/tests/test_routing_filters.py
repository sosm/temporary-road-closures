"""
Unit tests for the server-side closure->routing-mode filter.

These assert parity with the frontend truth table in
``frontend/utils/routing-utils.ts`` (transportModeMap x closureTypeEffects),
including the "unknown key -> all modes" fallback. Pure functions, no DB.
"""

import pytest

from app.models.closure import ClosureType, TransportMode
from app.schemas.routing import RoutingMode
from app.services.routing_filters import does_closure_affect_mode

# Expected truth, transcribed independently from routing-utils.ts so the test is
# a real cross-check of the Python port (not a copy of the same dicts).

# transportModeMap (routing-utils.ts:8-17)
_FE_TRANSPORT_MODE_MAP = {
    "all": {"auto", "bicycle", "pedestrian"},
    "car": {"auto"},
    "hgv": {"auto"},
    "bicycle": {"bicycle"},
    "foot": {"pedestrian"},
    "motorcycle": {"auto"},
    "bus": {"auto"},
    "emergency": {"auto"},
}

# closureTypeEffects (routing-utils.ts:19-31)
_FE_CLOSURE_TYPE_EFFECTS = {
    "construction": {"auto", "bicycle"},
    "accident": {"auto", "bicycle"},
    "event": {"auto"},
    "maintenance": {"auto", "bicycle"},
    "weather": {"auto", "bicycle", "pedestrian"},
    "emergency": {"auto", "bicycle", "pedestrian"},
    "other": {"auto", "bicycle", "pedestrian"},
    "sidewalk_repair": {"pedestrian"},
    "bike_lane_closure": {"bicycle"},
    "bridge_closure": {"auto", "bicycle", "pedestrian"},
    "tunnel_closure": {"auto", "bicycle", "pedestrian"},
}

_ALL = {"auto", "bicycle", "pedestrian"}


def _expected(closure_type: str, transport_mode: str, mode: str) -> bool:
    by_type = _FE_CLOSURE_TYPE_EFFECTS.get(closure_type, _ALL)
    by_transport = _FE_TRANSPORT_MODE_MAP.get(transport_mode, _ALL)
    return mode in by_type and mode in by_transport


@pytest.mark.parametrize("closure_type", [ct.value for ct in ClosureType])
@pytest.mark.parametrize("transport_mode", [tm.value for tm in TransportMode])
@pytest.mark.parametrize("mode", [m.value for m in RoutingMode])
def test_does_closure_affect_mode_matches_frontend(closure_type, transport_mode, mode):
    assert does_closure_affect_mode(
        closure_type, transport_mode, RoutingMode(mode)
    ) == _expected(closure_type, transport_mode, mode)


def test_unknown_closure_type_falls_back_to_all():
    # Unknown type -> treated as all modes; transport "car" still narrows to auto.
    assert does_closure_affect_mode("nonexistent_type", "car", RoutingMode.AUTO) is True
    assert (
        does_closure_affect_mode("nonexistent_type", "car", RoutingMode.BICYCLE)
        is False
    )


def test_unknown_transport_mode_falls_back_to_all():
    # Unknown transport -> all modes; type "bike_lane_closure" still narrows.
    assert (
        does_closure_affect_mode("bike_lane_closure", "spaceship", RoutingMode.BICYCLE)
        is True
    )
    assert (
        does_closure_affect_mode("bike_lane_closure", "spaceship", RoutingMode.AUTO)
        is False
    )
