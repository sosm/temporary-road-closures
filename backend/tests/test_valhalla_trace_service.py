"""
Tests for the Valhalla ``trace_attributes`` map-matching client.

Valhalla is mocked throughout (mirroring test_routing_service.py) so the suite
stays runnable without a live tile server. The canned response body below is a
trimmed capture of a real Valhalla 3.5.1 response for a short Zurich trace.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.valhalla_trace_service import (
    MatchedEdge,
    TraceResult,
    ValhallaTraceService,
    _coordinates_to_shape,
    _parse_edges,
)

# Real Valhalla 3.5.1 output (trimmed). Note `length` is in KILOMETRES even
# though the response advertises `units`; the service converts to metres.
_TRACE_RESPONSE = {
    "units": "kilometers",
    "shape": "sjrjyAmmhhO{Aj@mAd@uBZiB`@{G`Dm",
    "edges": [
        {
            "road_class": "residential",
            "use": "road",
            "begin_heading": 342,
            "end_heading": 342,
            "length": 0.005,
            "way_id": 1121964954,
        },
        {
            "road_class": "residential",
            "use": "road",
            "begin_heading": 348,
            "end_heading": 360,
            "length": 0.076,
            "way_id": 146778063,
        },
        {
            "road_class": "tertiary",
            "use": "road",
            "begin_heading": 85,
            "end_heading": 86,
            "length": 0.030,
            "way_id": 602621673,
        },
    ],
}

_COORDS = [[8.5410, 47.3760], [8.5430, 47.3770], [8.5450, 47.3780]]


def _mock_response(status_code=200, json_data=None, text=""):
    response = MagicMock()
    response.status_code = status_code
    response.text = text
    if json_data is None:
        response.json.side_effect = ValueError("no json")
    else:
        response.json.return_value = json_data
    return response


def _patched_client(response=None, side_effect=None):
    """Patch httpx.AsyncClient so `async with ... as client` yields our mock."""
    client = MagicMock()
    client.post = AsyncMock(return_value=response, side_effect=side_effect)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=client)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return patch("httpx.AsyncClient", return_value=ctx), client


# --- pure helpers -----------------------------------------------------------


def test_coordinates_to_shape_converts_lon_lat_to_lat_lon():
    assert _coordinates_to_shape([[8.5410, 47.3760], [8.5450, 47.3780]]) == [
        {"lat": 47.3760, "lon": 8.5410},
        {"lat": 47.3780, "lon": 8.5450},
    ]


def test_coordinates_to_shape_ignores_elevation():
    assert _coordinates_to_shape([[8.54, 47.37, 412.0]]) == [
        {"lat": 47.37, "lon": 8.54}
    ]


def test_parse_edges_converts_km_to_metres():
    edges = _parse_edges(_TRACE_RESPONSE)
    assert [e.length_m for e in edges] == [5.0, 76.0, 30.0]


def test_parse_edges_reads_attributes():
    first = _parse_edges(_TRACE_RESPONSE)[0]
    assert first.road_class == "residential"
    assert first.use == "road"
    assert first.begin_heading == 342
    assert first.way_id == 1121964954


def test_parse_edges_skips_malformed_entries_but_keeps_good_ones():
    payload = {
        "edges": [
            {"road_class": "primary", "use": "road", "length": 0.1},
            "not-a-dict",
            {"road_class": "primary", "use": "road", "length": "bogus"},
            {"road_class": "tertiary", "use": "road", "length": 0.2},
        ]
    }
    edges = _parse_edges(payload)
    assert [e.length_m for e in edges] == [100.0, 200.0]


def test_parse_edges_on_empty_payload():
    assert _parse_edges({}) == []


def test_trace_result_total_length():
    result = TraceResult(
        edges=[
            MatchedEdge("residential", "road", 0, 0, 100.0),
            MatchedEdge("tertiary", "road", 90, 90, 250.0),
        ]
    )
    assert result.total_length_m == 350.0


# --- request construction ---------------------------------------------------


@pytest.mark.asyncio
async def test_trace_attributes_builds_expected_request():
    patcher, client = _patched_client(_mock_response(200, _TRACE_RESPONSE))
    with patcher:
        service = ValhallaTraceService(base_url="http://valhalla:8002/", timeout=5.0)
        await service.trace_attributes(_COORDS, costing="bicycle")

    url, kwargs = client.post.call_args[0][0], client.post.call_args[1]
    # Trailing slash on base_url must not produce a double slash.
    assert url == "http://valhalla:8002/trace_attributes"
    body = kwargs["json"]
    assert body["costing"] == "bicycle"
    assert body["shape_match"] == "map_snap"
    assert body["shape"][0] == {"lat": 47.3760, "lon": 8.5410}
    assert "edge.road_class" in body["filters"]["attributes"]
    assert "edge.begin_heading" in body["filters"]["attributes"]
    assert body["filters"]["action"] == "include"


@pytest.mark.asyncio
async def test_trace_attributes_returns_parsed_result():
    patcher, _ = _patched_client(_mock_response(200, _TRACE_RESPONSE))
    with patcher:
        result = await ValhallaTraceService().trace_attributes(_COORDS)

    assert result is not None
    assert len(result.edges) == 3
    assert result.total_length_m == 111.0
    assert result.shape == _TRACE_RESPONSE["shape"]


# --- failure paths: every one returns None, never raises --------------------


@pytest.mark.asyncio
async def test_too_few_coordinates_returns_none():
    service = ValhallaTraceService()
    assert await service.trace_attributes([[8.54, 47.37]]) is None
    assert await service.trace_attributes([]) is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "exc",
    [httpx.TimeoutException("timed out"), httpx.ConnectError("refused")],
)
async def test_transport_errors_return_none(exc):
    patcher, _ = _patched_client(side_effect=exc)
    with patcher:
        assert await ValhallaTraceService().trace_attributes(_COORDS) is None


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [400, 404, 500, 503])
async def test_non_200_returns_none(status):
    patcher, _ = _patched_client(_mock_response(status, {}, text="upstream said no"))
    with patcher:
        assert await ValhallaTraceService().trace_attributes(_COORDS) is None


@pytest.mark.asyncio
async def test_invalid_json_returns_none():
    patcher, _ = _patched_client(_mock_response(200, None))
    with patcher:
        assert await ValhallaTraceService().trace_attributes(_COORDS) is None


@pytest.mark.asyncio
async def test_non_dict_payload_returns_none():
    patcher, _ = _patched_client(_mock_response(200, ["unexpected"]))
    with patcher:
        assert await ValhallaTraceService().trace_attributes(_COORDS) is None


@pytest.mark.asyncio
async def test_no_edges_returns_none():
    patcher, _ = _patched_client(_mock_response(200, {"edges": []}))
    with patcher:
        assert await ValhallaTraceService().trace_attributes(_COORDS) is None
