"""
Unit tests for the server-side closure->routing-mode filter.

These assert parity with the frontend truth table in
``frontend/utils/routing-utils.ts`` (transportModeMap x closureTypeEffects),
including the "unknown key -> all modes" fallback. Pure functions, no DB.
"""

import logging

import pytest

from app.models.closure import ClosureType, TransportMode
from app.schemas.routing import RoutingMode
from app.services.routing_filters import (
    TRANSPORT_MODE_COSTING,
    TRANSPORT_MODE_MAP,
    costing_for_transport_mode,
    does_closure_affect_mode,
)

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


# --- transport_mode -> Valhalla costing (OpenLR map-matching) ----------------


@pytest.mark.parametrize(
    ("transport_mode", "expected"),
    [
        ("car", "auto"),
        ("hgv", "auto"),
        ("motorcycle", "auto"),
        ("bus", "auto"),
        ("emergency", "auto"),
        ("bicycle", "bicycle"),
        ("foot", "pedestrian"),
        ("all", "auto"),
    ],
)
def test_costing_for_each_transport_mode(transport_mode, expected):
    assert costing_for_transport_mode(transport_mode) == expected


def test_every_db_transport_mode_is_mapped():
    """No DB enum value may reach Valhalla via the unknown-key fallback."""
    for mode in TransportMode:
        assert mode.value in TRANSPORT_MODE_COSTING


def test_all_maps_to_auto_explicitly_not_by_fallback():
    """
    "all" is a deliberate entry, not an accident of the unknown-key fallback:
    removing it must change behaviour detectably, so assert the key is present
    rather than only that the returned value happens to be "auto".
    """
    assert "all" in TRANSPORT_MODE_COSTING
    assert TRANSPORT_MODE_COSTING["all"] == "auto"


@pytest.mark.parametrize("bad_mode", ["spaceship", "", None, "AUTO", "Foot"])
def test_unknown_transport_mode_falls_back_to_auto(bad_mode, caplog):
    with caplog.at_level(logging.WARNING, logger="app.services.routing_filters"):
        assert costing_for_transport_mode(bad_mode) == "auto"
    assert "Unknown transport_mode" in caplog.text


def test_costing_is_consistent_with_the_routing_mode_map():
    """Single-mode entries in TRANSPORT_MODE_MAP must agree with our costing."""
    single_mode_costing = {
        RoutingMode.AUTO: "auto",
        RoutingMode.BICYCLE: "bicycle",
        RoutingMode.PEDESTRIAN: "pedestrian",
    }
    for mode, routing_modes in TRANSPORT_MODE_MAP.items():
        if len(routing_modes) == 1:
            assert costing_for_transport_mode(mode) == single_mode_costing[
                routing_modes[0]
            ], f"{mode} disagrees with TRANSPORT_MODE_MAP"
