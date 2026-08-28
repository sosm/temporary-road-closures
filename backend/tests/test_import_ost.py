"""
Tests for the OST prealigner feed import skeleton.

The feed publishes no structured type or date fields -- both are extracted
best-effort by regex from the free-text comment:de clause -- so most of what
is worth testing here is the parsing and its failure modes. Also covered:
the deleted-record skip, the per-feature partial-success contract, and -- as
with every other import source since PR #127 -- that an imported closure comes
back with a real OpenLR code rather than NULL.

Valhalla is mocked (mirroring test_valhalla_trace_service.py) so the suite
runs without a live tile server.
"""

import asyncio
import itertools
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.concurrency import run_in_threadpool

from app.models.closure import ClosureType, TransportMode
from app.schemas.import_data import ImportFormat, ImportOptions
from app.services.import_service import ImportService
from app.services.valhalla_trace_service import MatchedEdge, TraceResult

FIXTURE = Path(__file__).parent / "fixtures" / "ost_closures.json"

_EDGES = [MatchedEdge("residential", "road", 342.0, 342.0, 55.0, 1121964954)]

# Zurich geometry, shared with the other OpenLR tests -- known to map-match.
_COORDS = [[8.5410, 47.3760], [8.5430, 47.3770], [8.5450, 47.3780]]

# The real feed HTML-escapes its text and separates clauses with non-breaking
# spaces; both quirks are reproduced here so the normalisation path is exercised.
_COMMENT_DE = (
    "Freigegeben: Bahnhofstrasse 12, 8001 Zürich, Switzerland &lt;-&gt; "
    "Bahnhofstrasse 24, 8001 Zürich, Switzerland  "
    "Sachlage: Verkehrsbehinderung Baustelle "
    "Dauer:  voraussichtlich 24.08.2026 07:00 bis 11.09.2026 17:30 "
    "Empfehlung: eine lokale Umleitung ist eingerichtet "
    "Empfohlene Umleitung: lokale Umleitung"
)


def _feature(comment=_COMMENT_DE, geometry=..., **properties):
    if geometry is ...:
        geometry = {"type": "LineString", "coordinates": _COORDS}
    props = {
        "comment:de": comment,
        "comment:fr": "Libéré: ... Durée: probable ...",
        "comment:it": "Approvato: ... Durata: probabile ...",
        "osm_routepoints": [451198454, 451198455, 451198456],
        "osm_start_node_offset_m": 25,
        "osm_end_node_offset_m": -100,
        "is_deleted": False,
    }
    props.update(properties)
    return {"type": "Feature", "properties": props, "geometry": geometry}


def _collection(*features):
    return {"type": "FeatureCollection", "features": list(features)}


def _options():
    return ImportOptions(
        format=ImportFormat.OST,
        attribution="OST - Ostschweizer Fachhochschule",
        source="ost-prealigner",
        default_confidence=7,
    )


def _import_service(trace_result=TraceResult(edges=_EDGES)):
    """See test_import_openlr._import_service -- same construction."""
    trace_service = MagicMock()
    trace_service.trace_attributes = AsyncMock(return_value=trace_result)
    service = ImportService(db=MagicMock())
    service.closure_service.openlr_service.trace_service = trace_service

    ids = itertools.count(1)
    service.closure_service.db.refresh.side_effect = lambda obj: setattr(
        obj, "id", next(ids)
    )
    return service


def _created_closures(service):
    return [call.args[0] for call in service.closure_service.db.add.call_args_list]


def _run_import(service, data):
    """Import the way the API handler does: from a loop, via the threadpool."""

    async def handler():
        return await run_in_threadpool(
            service.import_ost_data,
            data=data,
            options=_options(),
            user_id=1,
        )

    return asyncio.run(handler())


def _parse(feature):
    return ImportService(db=MagicMock())._create_closure_from_ost_feature(
        feature, _options()
    )


def _with_sachlage(sachlage):
    return _COMMENT_DE.replace("Verkehrsbehinderung Baustelle", sachlage)


def _with_dauer(dauer):
    return _COMMENT_DE.replace(
        "Dauer:  voraussichtlich 24.08.2026 07:00 bis 11.09.2026 17:30",
        f"Dauer: {dauer}",
    )


# --- comment normalisation --------------------------------------------------


def test_html_entities_are_unescaped_in_the_description():
    """The feed escapes its address separator as &lt;-&gt;."""
    description = _parse(_feature()).description
    assert "<->" in description
    assert "&lt;" not in description


def test_non_breaking_spaces_do_not_break_parsing():
    """Clause separators are \\xa0, which a naive split on ' ' would miss."""
    closure = _parse(_feature())
    assert " " not in closure.description
    assert closure.start_time.hour == 7


def test_missing_german_comment_is_rejected():
    with pytest.raises(ValueError, match="comment:de"):
        _parse(_feature(comment=None))


# --- Sachlage vocabulary ----------------------------------------------------


@pytest.mark.parametrize(
    ("sachlage", "expected"),
    [
        ("Verkehrsbehinderung Baustelle", ClosureType.CONSTRUCTION),
        ("Verkehrsbehinderung Bauarbeiten", ClosureType.CONSTRUCTION),
        ("Verkehrsbehinderung Unfall", ClosureType.ACCIDENT),
        ("Verkehrsbehinderung Veranstaltung", ClosureType.EVENT),
        ("Verkehrsbehinderung Unterhalt", ClosureType.MAINTENANCE),
        ("Verkehrsbehinderung Witterung", ClosureType.WEATHER),
    ],
)
def test_sachlage_vocabulary_is_mapped(sachlage, expected):
    assert _parse(_feature(comment=_with_sachlage(sachlage))).closure_type is expected


def test_unknown_sachlage_falls_back_to_other():
    """An unmapped cause must degrade, not fail the record."""
    closure = _parse(_feature(comment=_with_sachlage("Gleisersatzarbeiten")))
    assert closure.closure_type is ClosureType.OTHER


def test_missing_sachlage_clause_falls_back_to_other():
    comment = _COMMENT_DE.replace("Sachlage: Verkehrsbehinderung Baustelle ", "")
    assert _parse(_feature(comment=comment)).closure_type is ClosureType.OTHER


# --- Dauer parsing ----------------------------------------------------------


def test_duration_is_parsed_as_utc():
    closure = _parse(_feature())
    assert (closure.start_time.year, closure.start_time.month) == (2026, 8)
    assert (closure.start_time.day, closure.start_time.hour) == (24, 7)
    assert (closure.end_time.day, closure.end_time.minute) == (11, 30)
    assert closure.start_time.utcoffset().total_seconds() == 0


def test_dates_without_times_default_to_midnight():
    closure = _parse(_feature(comment=_with_dauer("01.09.2026 bis 30.09.2026")))
    assert closure.start_time.hour == 0
    assert closure.end_time.day == 30


def test_open_ended_duration_is_rejected():
    """"bis auf Weiteres" has no end date -- reject rather than guess one."""
    with pytest.raises(ValueError, match="Cannot parse OST duration"):
        _parse(_feature(comment=_with_dauer("bis auf Weiteres")))


def test_missing_dauer_clause_is_rejected():
    comment = _COMMENT_DE.split("Dauer:")[0]
    with pytest.raises(ValueError, match="Cannot parse OST duration"):
        _parse(_feature(comment=comment))


def test_end_before_start_is_rejected():
    with pytest.raises(ValueError, match="end is not after start"):
        _parse(_feature(comment=_with_dauer("11.09.2026 17:30 bis 24.08.2026 07:00")))


def test_impossible_date_is_rejected():
    with pytest.raises(ValueError, match="Cannot parse OST duration"):
        _parse(_feature(comment=_with_dauer("32.13.2026 07:00 bis 30.13.2026 17:00")))


# --- geometry ---------------------------------------------------------------


def test_geometry_comes_from_the_precomputed_field():
    """osm_routepoints resolution is a follow-up; the feed's LineString is used."""
    geometry = _parse(_feature()).geometry
    assert geometry.type == "LineString"
    assert len(geometry.coordinates) == 3


def test_missing_geometry_is_rejected():
    with pytest.raises(ValueError, match="No geometry"):
        _parse(_feature(geometry=None))


def test_single_point_linestring_is_rejected():
    with pytest.raises(ValueError, match="at least 2 coordinates"):
        _parse(_feature(geometry={"type": "LineString", "coordinates": [_COORDS[0]]}))


def test_unsupported_geometry_type_is_rejected():
    with pytest.raises(ValueError, match="Unsupported OST geometry"):
        _parse(_feature(geometry={"type": "Point", "coordinates": _COORDS[0]}))


# --- field mapping ----------------------------------------------------------


def test_description_carries_status_location_and_cause():
    description = _parse(_feature()).description
    assert "Freigegeben" in description
    assert "Bahnhofstrasse 12" in description
    assert "Verkehrsbehinderung Baustelle" in description


def test_transport_mode_defaults_to_all():
    """The feed carries no affected-modes field."""
    assert _parse(_feature()).transport_mode is TransportMode.ALL


def test_options_supply_provenance():
    closure = _parse(_feature())
    assert closure.source == "ost-prealigner"
    assert closure.attribution == "OST - Ostschweizer Fachhochschule"
    assert closure.confidence_level == 7


# --- deleted records --------------------------------------------------------


def test_deleted_records_are_skipped_not_failed():
    """is_deleted is valid input with nothing to do, not malformed data."""
    service = _import_service()

    result = _run_import(
        service, _collection(_feature(), _feature(is_deleted=True), _feature())
    )

    assert result.total_records == 3
    assert result.imported_count == 2
    assert result.skipped_count == 1
    assert result.failed_count == 0
    assert result.success is True
    assert result.errors == []


def test_a_deleted_record_is_not_parsed_at_all():
    """Skipping happens before parsing, so a malformed deleted row is harmless."""
    service = _import_service()

    result = _run_import(
        service, _collection(_feature(comment="nonsense", is_deleted=True))
    )

    assert result.skipped_count == 1
    assert result.failed_count == 0
    assert _created_closures(service) == []


# --- partial success --------------------------------------------------------


def test_one_bad_feature_does_not_block_the_batch():
    """The established contract: per-record failure, batch continues."""
    service = _import_service()
    data = _collection(_feature(), _feature(geometry=None), _feature())

    result = _run_import(service, data)

    assert result.total_records == 3
    assert result.imported_count == 2
    assert result.failed_count == 1
    assert result.success is False
    assert len(result.errors) == 1
    assert result.errors[0].startswith("Feature 1:")
    assert len(result.closure_ids) == 2


def test_all_valid_features_report_success():
    service = _import_service()
    result = _run_import(service, _collection(_feature(), _feature()))

    assert result.success is True
    assert result.imported_count == 2
    assert result.failed_count == 0


def test_empty_feed_is_not_an_error():
    result = _run_import(_import_service(), _collection())
    assert result.total_records == 0
    assert result.success is True


def test_non_feature_collection_is_rejected():
    with pytest.raises(Exception, match="FeatureCollection"):
        _run_import(_import_service(), {"type": "Feature", "features": []})


# --- OpenLR (the PR #127 regression, for this source) -----------------------


def test_imported_ost_closure_gets_an_openlr_code():
    """
    Run the import as the API handler does and assert a real code. A None
    here means encoding was skipped by the event-loop deadlock guard.
    """
    service = _import_service()

    result = _run_import(service, _collection(_feature()))

    assert result.imported_count == 1
    closures = _created_closures(service)
    assert len(closures) == 1
    assert closures[0].openlr_code, (
        "imported closure must carry an OpenLR code; None means map matching "
        "was skipped by the event-loop deadlock guard"
    )


def test_ost_closures_map_match_with_auto_costing():
    """No mode field in the feed means ALL, which routes as auto."""
    service = _import_service()

    _run_import(service, _collection(_feature()))

    calls = (
        service.closure_service.openlr_service.trace_service.trace_attributes.call_args_list
    )
    assert calls, "expected at least one trace_attributes call"
    assert {call.kwargs["costing"] for call in calls} == {"auto"}


def test_import_still_succeeds_when_map_matching_fails():
    """Best-effort contract: no code, but the closure still saves."""
    service = _import_service(trace_result=None)

    result = _run_import(service, _collection(_feature()))

    assert result.imported_count == 1
    assert _created_closures(service)[0].openlr_code is None


# --- fixture ----------------------------------------------------------------


def test_fixture_imports_with_the_expected_partial_success():
    """
    The shipped fixture is the live-verification payload: 2 importable records
    (one exercising the unknown-Sachlage fallback), 1 deleted, and 2 malformed
    (open-ended duration, missing geometry).
    """
    service = _import_service()
    data = json.loads(FIXTURE.read_text())

    result = _run_import(service, data)

    assert result.total_records == 5
    assert result.imported_count == 2
    assert result.skipped_count == 1
    assert result.failed_count == 2
    assert all(c.openlr_code for c in _created_closures(service))

    # The unmapped "Gleisersatzarbeiten" record still imports, as OTHER.
    assert any(
        c.closure_type == ClosureType.OTHER.value for c in _created_closures(service)
    )


def test_fixture_dispatches_through_import_data():
    """format=ost routes to the OST importer."""
    service = _import_service()
    content = FIXTURE.read_bytes()

    async def handler():
        return await run_in_threadpool(
            service.import_data,
            content=content,
            options=_options(),
            user_id=1,
        )

    result = asyncio.run(handler())

    assert result.imported_count == 2
    assert _created_closures(service)[0].openlr_code
