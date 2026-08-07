"""
Translation from Valhalla map-matched road attributes to OpenLR primitives.

Everything here is pure: given matched edges and coordinates, produce the
``LocationReferencePoint`` list that ``openlr.binary_encode`` expects. No I/O,
no settings access, no side effects -- so the mapping decisions (which are
judgement calls that only an independent decoder can confirm) stay directly
unit-testable.

Encoder limits verified against openlr 1.0.1:

* ``bear`` is **degrees** (0-359); the library quantises to 32 sectors of
  11.25 degrees internally. Passing a pre-computed sector index silently
  corrupts the bearing.
* ``dnp`` is metres and is written as a single byte scaled by ~58.6 m, so it
  **cannot exceed 15000 m** -- beyond that ``binary_encode`` raises
  ``ValueError``. Long spans must be split.
* ``poffs``/``noffs`` are fractions in ``[0, 1)``, not metres.
* The final LRP must carry ``lfrcnp=None`` and ``dnp=None``.
"""

import math
from typing import Iterable, List, Optional, Sequence

from openlr import FOW, FRC, LineLocationReference, LocationReferencePoint

# OpenLR writes DNP as one byte scaled by 255/15000; anything at or above this
# overflows the byte. Keep a small safety margin below the hard ceiling.
MAX_DNP_METERS = 15000
_DNP_SAFETY_LIMIT = 14000

# Valhalla `road_class` -> OpenLR Functional Road Class.
# Valhalla's vocabulary: motorway, trunk, primary, secondary, tertiary,
# unclassified, residential, service_other.
_ROAD_CLASS_TO_FRC = {
    "motorway": FRC.FRC0,
    "trunk": FRC.FRC1,
    "primary": FRC.FRC2,
    "secondary": FRC.FRC3,
    "tertiary": FRC.FRC4,
    "unclassified": FRC.FRC5,
    "residential": FRC.FRC5,
    "service_other": FRC.FRC7,
}

# Valhalla `use` values that map directly to a Form of Way, regardless of class.
_USE_TO_FOW = {
    "roundabout": FOW.ROUNDABOUT,
    "ramp": FOW.SLIPROAD,
    "turn_channel": FOW.SLIPROAD,
}


def road_class_to_frc(road_class: Optional[str]) -> FRC:
    """Map a Valhalla ``road_class`` to an OpenLR Functional Road Class.

    Unknown or missing values fall back to ``FRC7`` (lowest importance), which
    is the safest default: it never overstates a road's significance.
    """
    if not road_class:
        return FRC.FRC7
    return _ROAD_CLASS_TO_FRC.get(road_class.strip().lower(), FRC.FRC7)


def to_fow(use: Optional[str], road_class: Optional[str]) -> FOW:
    """Map Valhalla ``use`` + ``road_class`` to an OpenLR Form of Way.

    ``use`` wins when it describes the road's form (roundabout, ramp).
    Otherwise the form is inferred from class: motorways are dual carriageways,
    everything else is treated as a single carriageway.
    """
    normalised_use = (use or "").strip().lower()
    if normalised_use in _USE_TO_FOW:
        return _USE_TO_FOW[normalised_use]

    normalised_class = (road_class or "").strip().lower()
    if normalised_class == "motorway":
        return FOW.MOTORWAY
    if normalised_class == "trunk":
        return FOW.MULTIPLE_CARRIAGEWAY
    if normalised_class in _ROAD_CLASS_TO_FRC:
        return FOW.SINGLE_CARRIAGEWAY
    return FOW.UNDEFINED


def heading_to_bearing(heading: Optional[float]) -> int:
    """Normalise a compass heading to the integer degrees OpenLR expects.

    The library quantises internally, so this only needs to land in [0, 360).
    """
    if heading is None:
        return 0
    try:
        return int(round(float(heading))) % 360
    except (TypeError, ValueError):
        return 0


def split_distance(distance_m: float, limit: int = _DNP_SAFETY_LIMIT) -> List[int]:
    """Split a span into DNP-encodable chunks, each at or below ``limit``.

    Returns the per-chunk distances in metres. A span within the limit yields a
    single chunk. Chunks are evenly sized so intermediate LRPs land at regular
    intervals rather than leaving a tiny remainder at the end.
    """
    metres = max(0, int(round(distance_m)))
    if metres <= limit:
        return [metres]

    chunk_count = math.ceil(metres / limit)
    base, remainder = divmod(metres, chunk_count)
    # Distribute the remainder across the first chunks so the total is exact.
    return [base + (1 if i < remainder else 0) for i in range(chunk_count)]


def _haversine_m(a: Sequence[float], b: Sequence[float]) -> float:
    """Great-circle distance in metres between two ``[lon, lat]`` points."""
    lon1, lat1 = a[0], a[1]
    lon2, lat2 = b[0], b[1]
    radius = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lon2 - lon1)
    h = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(h))


def initial_bearing(a: Sequence[float], b: Sequence[float]) -> int:
    """Compass bearing in degrees from point ``a`` to point ``b``.

    Used as a fallback when Valhalla supplies no heading for a segment.
    """
    lon1, lat1 = math.radians(a[0]), math.radians(a[1])
    lon2, lat2 = math.radians(b[0]), math.radians(b[1])
    d_lon = lon2 - lon1
    y = math.sin(d_lon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(
        d_lon
    )
    return int(round(math.degrees(math.atan2(y, x)))) % 360


def sample_coordinates(
    coordinates: Sequence[Sequence[float]], max_points: int
) -> List[List[float]]:
    """Reduce ``coordinates`` to at most ``max_points``, keeping both endpoints.

    Interior points are sampled at even index intervals. This enforces
    ``OPENLR_MAX_POINTS``, which keeps codes compact -- it is a size/sanity
    limit, not a format limit (the binary format handles far more).
    """
    points = [list(c) for c in coordinates]
    if max_points < 2:
        # Degenerate request; an LRP list needs at least two points.
        max_points = 2
    if len(points) <= max_points:
        return points

    interior_slots = max_points - 2
    last_index = len(points) - 1
    sampled = [points[0]]
    for i in range(1, interior_slots + 1):
        index = round(i * last_index / (interior_slots + 1))
        # Guard against duplicate indices at small sizes.
        if index != 0 and index != last_index and points[index] not in sampled:
            sampled.append(points[index])
    sampled.append(points[last_index])
    return sampled


def _edge_at_fraction(edges: Sequence, fraction: float):
    """Pick the matched edge nearest a fractional position along the path.

    Valhalla returns one edge per matched road segment, while the LRPs are a
    coarser sample of the geometry, so each LRP borrows attributes from the
    edge covering roughly the same position along the route.
    """
    if not edges:
        return None
    index = min(int(fraction * len(edges)), len(edges) - 1)
    return edges[index]


def build_location_reference_points(
    coordinates: Sequence[Sequence[float]],
    edges: Sequence,
    max_points: int = 15,
) -> List[LocationReferencePoint]:
    """Assemble the OpenLR LRP list for a map-matched line location.

    ``edges`` are ``MatchedEdge`` objects from ``ValhallaTraceService``; their
    road class, use and heading supply the attributes the OpenLR spec requires
    and that raw geometry cannot provide.

    Spans longer than the DNP ceiling are subdivided with interpolated LRPs so
    the result always encodes.
    """
    points = sample_coordinates(coordinates, max_points)
    if len(points) < 2:
        raise ValueError("At least 2 coordinates are required to build LRPs")

    total_span = sum(
        _haversine_m(points[i], points[i + 1]) for i in range(len(points) - 1)
    )

    lrps: List[LocationReferencePoint] = []
    travelled = 0.0

    for i in range(len(points) - 1):
        start, end = points[i], points[i + 1]
        segment_m = _haversine_m(start, end)
        fraction = (travelled / total_span) if total_span else 0.0
        edge = _edge_at_fraction(edges, fraction)

        frc = road_class_to_frc(getattr(edge, "road_class", None))
        fow = to_fow(getattr(edge, "use", None), getattr(edge, "road_class", None))
        heading = getattr(edge, "begin_heading", None)
        bear = (
            heading_to_bearing(heading)
            if heading is not None
            else initial_bearing(start, end)
        )

        # Subdivide anything the DNP byte cannot represent, interpolating the
        # intermediate LRPs linearly along the segment.
        chunks = split_distance(segment_m)
        consumed = 0
        for chunk_index, chunk in enumerate(chunks):
            if chunk_index == 0:
                lon, lat = start[0], start[1]
            else:
                ratio = consumed / segment_m if segment_m else 0.0
                lon = start[0] + (end[0] - start[0]) * ratio
                lat = start[1] + (end[1] - start[1]) * ratio
            lrps.append(
                LocationReferencePoint(
                    lon=lon,
                    lat=lat,
                    frc=frc,
                    fow=fow,
                    bear=bear,
                    lfrcnp=frc,
                    dnp=chunk,
                )
            )
            consumed += chunk

        travelled += segment_m

    # Final LRP: terminates the chain, so it carries no onward path attributes.
    last_edge = edges[-1] if len(edges) else None
    final = points[-1]
    penultimate = points[-2]
    final_heading = getattr(last_edge, "end_heading", None)
    lrps.append(
        LocationReferencePoint(
            lon=final[0],
            lat=final[1],
            frc=road_class_to_frc(getattr(last_edge, "road_class", None)),
            fow=to_fow(
                getattr(last_edge, "use", None), getattr(last_edge, "road_class", None)
            ),
            bear=(
                heading_to_bearing(final_heading)
                if final_heading is not None
                else initial_bearing(penultimate, final)
            ),
            lfrcnp=None,
            dnp=None,
        )
    )

    return lrps


def build_line_location_reference(
    coordinates: Sequence[Sequence[float]],
    edges: Sequence,
    max_points: int = 15,
    poffs: float = 0.0,
    noffs: float = 0.0,
) -> LineLocationReference:
    """Build the complete ``LineLocationReference`` ready for ``binary_encode``.

    ``poffs``/``noffs`` are fractions in ``[0, 1)``; values outside that range
    raise inside the encoder, so they are clamped here.
    """
    lrps = build_location_reference_points(coordinates, edges, max_points=max_points)
    return LineLocationReference(
        points=lrps,
        poffs=_clamp_offset(poffs),
        noffs=_clamp_offset(noffs),
    )


def _clamp_offset(value: float) -> float:
    """Constrain an offset to the ``[0, 1)`` range the encoder accepts."""
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(numeric) or numeric <= 0:
        return 0.0
    # Just under 1.0 -- the encoder rejects 1.0 itself.
    return min(numeric, 0.999)
