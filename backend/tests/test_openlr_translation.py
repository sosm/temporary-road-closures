"""
Unit tests for the Valhalla -> OpenLR attribute translation layer.

These are pure-function tests: no DB, no network. They pin down the encoder
limits that were verified empirically against openlr 1.0.1 (bearing in degrees,
DNP ceiling, offsets as fractions, max-points enforcement).
"""

import openlr
import pytest
from openlr import FOW, FRC

from app.services.openlr_translation import (
    MAX_DNP_METERS,
    build_line_location_reference,
    build_location_reference_points,
    heading_to_bearing,
    initial_bearing,
    road_class_to_frc,
    sample_coordinates,
    split_distance,
    to_fow,
)
from app.services.valhalla_trace_service import MatchedEdge


def _edge(road_class="residential", use="road", begin=90.0, end=90.0, length_m=100.0):
    return MatchedEdge(road_class, use, begin, end, length_m)


# --- FRC --------------------------------------------------------------------


@pytest.mark.parametrize(
    "road_class,expected",
    [
        ("motorway", FRC.FRC0),
        ("trunk", FRC.FRC1),
        ("primary", FRC.FRC2),
        ("secondary", FRC.FRC3),
        ("tertiary", FRC.FRC4),
        ("unclassified", FRC.FRC5),
        ("residential", FRC.FRC5),
        ("service_other", FRC.FRC7),
    ],
)
def test_road_class_to_frc(road_class, expected):
    assert road_class_to_frc(road_class) == expected


@pytest.mark.parametrize("value", [None, "", "   ", "not_a_class"])
def test_unknown_road_class_falls_back_to_lowest_importance(value):
    assert road_class_to_frc(value) == FRC.FRC7


def test_road_class_is_case_and_whitespace_insensitive():
    assert road_class_to_frc("  MotorWay ") == FRC.FRC0


# --- FOW --------------------------------------------------------------------


@pytest.mark.parametrize(
    "use,road_class,expected",
    [
        ("roundabout", "residential", FOW.ROUNDABOUT),
        ("ramp", "motorway", FOW.SLIPROAD),
        ("turn_channel", "primary", FOW.SLIPROAD),
        ("road", "motorway", FOW.MOTORWAY),
        ("road", "trunk", FOW.MULTIPLE_CARRIAGEWAY),
        ("road", "residential", FOW.SINGLE_CARRIAGEWAY),
        ("road", "tertiary", FOW.SINGLE_CARRIAGEWAY),
    ],
)
def test_to_fow(use, road_class, expected):
    assert to_fow(use, road_class) == expected


def test_use_takes_precedence_over_road_class():
    # A roundabout on a motorway is still a roundabout.
    assert to_fow("roundabout", "motorway") == FOW.ROUNDABOUT


def test_unknown_inputs_give_undefined_fow():
    assert to_fow(None, None) == FOW.UNDEFINED
    assert to_fow("road", "nonsense") == FOW.UNDEFINED


# --- bearing ----------------------------------------------------------------


@pytest.mark.parametrize(
    "heading,expected",
    [(0, 0), (90, 90), (200, 200), (359, 359), (360, 0), (361, 1), (-1, 359)],
)
def test_heading_to_bearing_normalises_to_degrees(heading, expected):
    assert heading_to_bearing(heading) == expected


def test_heading_to_bearing_handles_bad_input():
    assert heading_to_bearing(None) == 0
    assert heading_to_bearing("not a number") == 0


def test_heading_is_degrees_not_a_sector_index():
    """Regression guard for the spec error this feature fixed.

    The naive `round(h/11.25) % 32` sector formula turns 90 degrees into 8,
    which the encoder then reads as 8 *degrees*. `bear` must stay in degrees.
    """
    assert heading_to_bearing(90) == 90
    assert heading_to_bearing(90) != round(90 / 11.25) % 32


def test_initial_bearing_cardinal_directions():
    # Due east and due north from a Zurich-ish origin.
    assert initial_bearing([8.54, 47.37], [8.55, 47.37]) == 90
    assert initial_bearing([8.54, 47.37], [8.54, 47.38]) == 0


# --- DNP splitting ----------------------------------------------------------


def test_short_distance_is_one_chunk():
    assert split_distance(500) == [500]


def test_distance_at_limit_is_not_split():
    assert split_distance(14000) == [14000]


def test_long_distance_is_split_below_the_dnp_ceiling():
    chunks = split_distance(40000)
    assert len(chunks) > 1
    assert all(c <= MAX_DNP_METERS for c in chunks)
    assert sum(chunks) == 40000


def test_split_preserves_total_distance_exactly():
    for total in (15001, 28000, 99999):
        assert sum(split_distance(total)) == total


def test_negative_distance_is_clamped():
    assert split_distance(-5) == [0]


# --- max-points enforcement -------------------------------------------------


def test_sample_coordinates_keeps_short_lines_intact():
    coords = [[8.54, 47.37], [8.55, 47.38]]
    assert sample_coordinates(coords, 15) == coords


def test_sample_coordinates_enforces_the_cap():
    coords = [[8.54 + i * 0.001, 47.37] for i in range(60)]
    sampled = sample_coordinates(coords, 15)
    assert len(sampled) <= 15


def test_sample_coordinates_always_keeps_both_endpoints():
    coords = [[8.54 + i * 0.001, 47.37] for i in range(60)]
    sampled = sample_coordinates(coords, 10)
    assert sampled[0] == coords[0]
    assert sampled[-1] == coords[-1]


# --- LRP assembly -----------------------------------------------------------


def test_lrp_count_matches_sampled_points():
    coords = [[8.5410, 47.3760], [8.5430, 47.3770], [8.5450, 47.3780]]
    lrps = build_location_reference_points(coords, [_edge(), _edge(), _edge()])
    assert len(lrps) == 3


def test_final_lrp_terminates_the_chain():
    """The last LRP must carry no onward path attributes, or encoding breaks."""
    coords = [[8.5410, 47.3760], [8.5450, 47.3780]]
    lrps = build_location_reference_points(coords, [_edge()])
    assert lrps[-1].lfrcnp is None
    assert lrps[-1].dnp is None
    assert all(p.dnp is not None for p in lrps[:-1])


def test_lrps_inherit_road_attributes_from_matched_edges():
    coords = [[8.5410, 47.3760], [8.5450, 47.3780]]
    lrps = build_location_reference_points(
        coords, [_edge(road_class="motorway", use="road", begin=42.0)]
    )
    assert lrps[0].frc == FRC.FRC0
    assert lrps[0].fow == FOW.MOTORWAY
    assert lrps[0].bear == 42


def test_bearing_falls_back_to_geometry_without_edges():
    # Due east; with no edges the bearing is derived from the coordinates.
    coords = [[8.54, 47.37], [8.55, 47.37]]
    lrps = build_location_reference_points(coords, [])
    assert lrps[0].bear == 90


def test_too_few_coordinates_raises():
    with pytest.raises(ValueError):
        build_location_reference_points([[8.54, 47.37]], [_edge()])


def test_long_span_is_subdivided_into_extra_lrps():
    # ~78 km apart: far beyond the DNP ceiling, so extra LRPs must appear.
    coords = [[8.0, 47.0], [9.0, 47.0]]
    lrps = build_location_reference_points(coords, [_edge()])
    assert len(lrps) > 2
    assert all(p.dnp <= MAX_DNP_METERS for p in lrps[:-1])


# --- end-to-end through the real encoder ------------------------------------


def test_built_reference_round_trips_through_binary_encode():
    coords = [[8.5410, 47.3760], [8.5430, 47.3770], [8.5450, 47.3780]]
    ref = build_line_location_reference(coords, [_edge(), _edge(), _edge()])

    code = openlr.binary_encode(ref)
    decoded = openlr.binary_decode(code)

    assert len(decoded.points) == len(ref.points)
    lon, lat = openlr.get_lonlat_list(decoded)[0]
    # 24-bit coordinate quantisation costs well under a metre.
    assert abs(lon - 8.5410) < 1e-4
    assert abs(lat - 47.3760) < 1e-4


def test_long_span_still_encodes_instead_of_raising():
    """Without DNP splitting, binary_encode raises ValueError here."""
    coords = [[8.0, 47.0], [9.0, 47.0]]
    ref = build_line_location_reference(coords, [_edge()])
    assert openlr.binary_encode(ref)


def test_offsets_are_clamped_into_the_encodable_range():
    coords = [[8.5410, 47.3760], [8.5450, 47.3780]]
    # Metre-style values would raise inside the encoder; they must be clamped.
    ref = build_line_location_reference(coords, [_edge()], poffs=100.0, noffs=-5.0)
    assert 0 <= ref.poffs < 1
    assert 0 <= ref.noffs < 1
    assert openlr.binary_encode(ref)


def test_max_points_caps_the_encoded_reference():
    coords = [[8.5410 + i * 0.0005, 47.3760] for i in range(40)]
    ref = build_line_location_reference(coords, [_edge()], max_points=8)
    assert len(ref.points) <= 8
    assert openlr.binary_encode(ref)
