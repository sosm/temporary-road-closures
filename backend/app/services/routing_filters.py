"""
Single source of truth for "does this closure affect this routing mode?".

This is a server-side port of the frontend logic in
``frontend/utils/routing-utils.ts`` (``transportModeMap``, ``closureTypeEffects``,
``doesClosureAffectMode``). Keep the two maps below in sync with that file.

Routing modes ("auto" | "bicycle" | "pedestrian") are the modes the routing
endpoint speaks; they differ from the DB ``TransportMode`` enum on the Closure
model. The maps translate a closure's ``transport_mode`` and ``closure_type``
into the set of routing modes it affects.
"""

from typing import List

from app.schemas.routing import RoutingMode

# All routing modes, used as the fallback for unknown keys (mirrors the
# frontend's `?? transportModeMap.all`).
_ALL_MODES: List[RoutingMode] = [
    RoutingMode.AUTO,
    RoutingMode.BICYCLE,
    RoutingMode.PEDESTRIAN,
]

# DB transport_mode value -> routing modes it can affect.
# Mirrors transportModeMap (routing-utils.ts:8-17). Keys are the string values
# of the DB TransportMode enum (models/closure.py:59).
TRANSPORT_MODE_MAP = {
    "all": [RoutingMode.AUTO, RoutingMode.BICYCLE, RoutingMode.PEDESTRIAN],
    "car": [RoutingMode.AUTO],
    "hgv": [RoutingMode.AUTO],
    "bicycle": [RoutingMode.BICYCLE],
    "foot": [RoutingMode.PEDESTRIAN],
    "motorcycle": [RoutingMode.AUTO],
    "bus": [RoutingMode.AUTO],
    "emergency": [RoutingMode.AUTO],
}

# closure_type value -> routing modes it affects.
# Mirrors closureTypeEffects (routing-utils.ts:19-31). Keys are the string
# values of the DB ClosureType enum (models/closure.py:33).
CLOSURE_TYPE_EFFECTS = {
    "construction": [RoutingMode.AUTO, RoutingMode.BICYCLE],
    "accident": [RoutingMode.AUTO, RoutingMode.BICYCLE],
    "event": [RoutingMode.AUTO],
    "maintenance": [RoutingMode.AUTO, RoutingMode.BICYCLE],
    "weather": [RoutingMode.AUTO, RoutingMode.BICYCLE, RoutingMode.PEDESTRIAN],
    "emergency": [RoutingMode.AUTO, RoutingMode.BICYCLE, RoutingMode.PEDESTRIAN],
    "other": [RoutingMode.AUTO, RoutingMode.BICYCLE, RoutingMode.PEDESTRIAN],
    "sidewalk_repair": [RoutingMode.PEDESTRIAN],
    "bike_lane_closure": [RoutingMode.BICYCLE],
    "bridge_closure": [RoutingMode.AUTO, RoutingMode.BICYCLE, RoutingMode.PEDESTRIAN],
    "tunnel_closure": [RoutingMode.AUTO, RoutingMode.BICYCLE, RoutingMode.PEDESTRIAN],
}


def does_closure_affect_mode(
    closure_type: str, transport_mode: str, mode: RoutingMode
) -> bool:
    """
    Whether a closure with the given ``closure_type`` and ``transport_mode``
    affects routing for ``mode``.

    Port of ``doesClosureAffectMode`` (routing-utils.ts:33-47), minus the
    ``status === "active"`` check — callers query active closures already.
    Unknown closure types / transport modes fall back to "all" modes, matching
    the frontend's ``?? transportModeMap.all``.
    """
    affected_by_type = CLOSURE_TYPE_EFFECTS.get(closure_type, _ALL_MODES)
    affected_by_transport = TRANSPORT_MODE_MAP.get(transport_mode, _ALL_MODES)
    return mode in affected_by_type and mode in affected_by_transport
