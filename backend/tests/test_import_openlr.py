"""
Regression tests for OpenLR encoding on the import path.

Imported closures were silently persisted with ``openlr_code = None``: the
import methods were ``async def`` and called the synchronous
``create_closure`` directly on the event loop, so ``OpenLRService._map_match``
hit its deadlock guard and degraded to ``None``. Every other create/update
call site already went through ``run_in_threadpool``.

The fix makes the import methods plain ``def`` and threadpools the whole
dispatch at the API handler. These tests lock in both halves: the sync
contract, and an actual code coming back when the import runs the way the
handler runs it.

Valhalla is mocked throughout (mirroring test_valhalla_trace_service.py) so
the suite stays runnable without a live tile server.
"""

import asyncio
import inspect
import itertools
import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.concurrency import run_in_threadpool

from app.schemas.import_data import ImportFormat, ImportOptions
from app.services.import_service import ImportService
from app.services.valhalla_trace_service import MatchedEdge, TraceResult

# Zurich fixture geometry, shared with test_openlr_integration.py -- known to
# map-match against the Switzerland extract.
_COORDS = [[8.5410, 47.3760], [8.5430, 47.3770], [8.5450, 47.3780]]
_LINE = {"type": "LineString", "coordinates": _COORDS}

_EDGES = [MatchedEdge("residential", "road", 342.0, 342.0, 55.0, 1121964954)]

_FEATURE = {
    "type": "Feature",
    "geometry": _LINE,
    "properties": {
        "description": "Zurich resurfacing",
        "closure_type": "construction",
        "transport_mode": "car",
        "start_time": "2026-08-19T10:00:00Z",
        "end_time": "2026-08-20T10:00:00Z",
    },
}


def _options(fmt=ImportFormat.GEOJSON):
    return ImportOptions(
        format=fmt,
        attribution="Test partner feed",
        source="test-source",
        default_confidence=8,
    )


def _import_service(trace_result=TraceResult(edges=_EDGES)):
    """
    ImportService whose Valhalla hop is canned but whose ``_map_match`` is
    *real* -- the deadlock guard under test lives inside ``_map_match``, so
    stubbing it would hide the very thing these tests exist to catch.

    The DB is mocked, so ``create_closure`` builds a real Closure object and
    runs the real encoding chain without touching Postgres.
    """
    trace_service = MagicMock()
    trace_service.trace_attributes = AsyncMock(return_value=trace_result)
    service = ImportService(db=MagicMock())
    service.closure_service.openlr_service.trace_service = trace_service

    # ImportResult requires int closure_ids; stand in for the identity a real
    # flush would assign, which MagicMock's no-op refresh() never does.
    ids = itertools.count(1)
    service.closure_service.db.refresh.side_effect = lambda obj: setattr(
        obj, "id", next(ids)
    )
    return service


def _created_closures(service):
    """The Closure ORM objects handed to db.add() during the import."""
    return [call.args[0] for call in service.closure_service.db.add.call_args_list]


# --- sync contract ----------------------------------------------------------


@pytest.mark.parametrize(
    "method_name",
    [
        "import_data",
        "import_geojson_data",
        "import_csv_data",
        "import_waze_data",
        "import_here_data",
        "import_tomtom_data",
    ],
)
def test_import_methods_are_synchronous(method_name):
    """
    These must stay plain ``def``. Making one ``async`` again would put
    create_closure back on the event loop and silently disable encoding.
    """
    method = getattr(ImportService, method_name)
    assert not inspect.iscoroutinefunction(method), (
        f"ImportService.{method_name} must be synchronous so it can be called "
        "via run_in_threadpool; see api/import_data.py"
    )


# --- the actual bug ---------------------------------------------------------


def test_geojson_import_produces_an_openlr_code_via_threadpool():
    """
    The regression: run the import exactly as the API handler does -- from a
    running event loop, through run_in_threadpool -- and assert a real code
    comes back. Before the fix this yielded None.
    """
    service = _import_service()
    data = {"type": "FeatureCollection", "features": [_FEATURE]}

    async def handler():
        return await run_in_threadpool(
            service.import_geojson_data,
            data=data,
            options=_options(),
            user_id=1,
        )

    result = asyncio.run(handler())

    assert result.imported_count == 1
    assert result.failed_count == 0

    closures = _created_closures(service)
    assert len(closures) == 1
    assert closures[0].openlr_code, (
        "imported closure must carry an OpenLR code; None means map matching "
        "was skipped by the event-loop deadlock guard"
    )


def test_csv_import_produces_an_openlr_code_via_threadpool():
    """The CSV importer funnels through the same create_closure call."""
    service = _import_service()
    csv_content = (
        "description,start_time,end_time,closure_type,transport_mode,"
        "geometry_type,coordinates\n"
        '"Zurich resurfacing",2026-08-19T10:00:00Z,2026-08-20T10:00:00Z,'
        f'construction,car,linestring,"{json.dumps(_COORDS)}"\n'
    )

    async def handler():
        return await run_in_threadpool(
            service.import_csv_data,
            content=csv_content,
            options=_options(ImportFormat.CSV),
            user_id=1,
        )

    result = asyncio.run(handler())

    assert result.imported_count == 1, result.errors
    assert _created_closures(service)[0].openlr_code


def test_import_data_dispatch_encodes_through_the_threadpool():
    """End-to-end through the format dispatcher, as import_closures calls it."""
    service = _import_service()
    content = json.dumps(
        {"type": "FeatureCollection", "features": [_FEATURE]}
    ).encode("utf-8")

    async def handler():
        return await run_in_threadpool(
            service.import_data,
            content=content,
            options=_options(),
            user_id=1,
        )

    result = asyncio.run(handler())

    assert result.imported_count == 1
    assert _created_closures(service)[0].openlr_code


def test_import_transport_mode_reaches_valhalla():
    """A car closure must map-match with auto costing, not a default."""
    service = _import_service()
    feature = json.loads(json.dumps(_FEATURE))
    feature["properties"]["transport_mode"] = "bicycle"
    data = {"type": "FeatureCollection", "features": [feature]}

    async def handler():
        return await run_in_threadpool(
            service.import_geojson_data,
            data=data,
            options=_options(),
            user_id=1,
        )

    asyncio.run(handler())

    calls = service.closure_service.openlr_service.trace_service.trace_attributes.call_args_list
    assert calls, "expected at least one trace_attributes call"
    assert {call.kwargs["costing"] for call in calls} == {"bicycle"}


# --- best-effort contract still holds ---------------------------------------


def test_import_still_succeeds_when_map_matching_fails():
    """
    A Valhalla outage must not fail the import -- the closure saves without a
    code, matching the behaviour of the single-closure create path.
    """
    service = _import_service(trace_result=None)
    data = {"type": "FeatureCollection", "features": [_FEATURE]}

    async def handler():
        return await run_in_threadpool(
            service.import_geojson_data,
            data=data,
            options=_options(),
            user_id=1,
        )

    result = asyncio.run(handler())

    assert result.imported_count == 1
    assert _created_closures(service)[0].openlr_code is None
