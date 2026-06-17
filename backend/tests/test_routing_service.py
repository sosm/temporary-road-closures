"""
Tests for closure-aware routing — request body construction, error mapping,
and endpoint integration (auto / bicycle / pedestrian).
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.main import app
from app.schemas.closure import GeoJSONGeometry
from app.schemas.routing import RoutingMode
from app.services.routing_service import RoutingError, get_route_with_closures

# A LineString closure near Zurich; buffer_closure turns it into a Polygon.
_LINE_CLOSURE = {
    "id": 1,
    "closure_type": "construction",
    "transport_mode": "all",
    "geometry": {
        "type": "LineString",
        "coordinates": [[8.5410, 47.3760], [8.5450, 47.3780]],
    },
    "geometry_type": "LineString",
}

_START = GeoJSONGeometry(type="Point", coordinates=[8.5417, 47.3769])
_END = GeoJSONGeometry(type="Point", coordinates=[8.5500, 47.3800])

_VALHALLA_OK = {"trip": {"status": 0, "summary": {"length": 1.2, "time": 90}}}


def _mock_closure_service(closures):
    svc = MagicMock()
    svc.get_active_closures_for_mode.return_value = closures
    return svc


def _real_spatial_service():
    from app.services.spatial_service import SpatialService

    return SpatialService(db=None)


def _mock_response(status_code=200, json_data=None, text=""):
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data if json_data is not None else _VALHALLA_OK
    resp.text = text
    return resp


def _patch_post(response=None, side_effect=None):
    """Patch httpx.AsyncClient.post used inside routing_service."""
    mock_post = AsyncMock(return_value=response, side_effect=side_effect)
    return patch("httpx.AsyncClient.post", mock_post), mock_post


# --------------------------------------------------------------------------- #
# Service-level unit tests
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_body_has_exclude_polygons_and_swapped_locations():
    closure_service = _mock_closure_service([_LINE_CLOSURE])
    spatial_service = _real_spatial_service()

    cm, mock_post = _patch_post(response=_mock_response())
    with cm:
        trip, excluded = await get_route_with_closures(
            _START, _END, RoutingMode.AUTO, closure_service, spatial_service
        )

    # get_route_with_closures returns Valhalla's inner trip object
    # (response.json()["trip"]), not the full envelope.
    assert trip == _VALHALLA_OK["trip"]
    assert excluded == 1

    _, kwargs = mock_post.call_args
    body = kwargs["json"]
    # Locations are {lat, lon}, swapped from GeoJSON [lon, lat].
    assert body["locations"][0] == {"lat": 47.3769, "lon": 8.5417, "type": "break"}
    assert body["locations"][1]["lon"] == 8.5500
    assert body["costing"] == "auto"
    # One buffered closure -> one exclude polygon (a ring of [lon, lat] points).
    assert len(body["exclude_polygons"]) == 1
    ring = body["exclude_polygons"][0]
    assert len(ring) >= 4  # closed ring
    # Coordinates are lon-first, near the closure.
    assert all(8.0 < pt[0] < 9.0 and 47.0 < pt[1] < 48.0 for pt in ring)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "mode", [RoutingMode.AUTO, RoutingMode.BICYCLE, RoutingMode.PEDESTRIAN]
)
async def test_costing_matches_mode(mode):
    closure_service = _mock_closure_service([])
    spatial_service = _real_spatial_service()

    cm, mock_post = _patch_post(response=_mock_response())
    with cm:
        await get_route_with_closures(
            _START, _END, mode, closure_service, spatial_service
        )
    assert mock_post.call_args.kwargs["json"]["costing"] == mode.value


@pytest.mark.asyncio
async def test_no_closures_omits_exclude_polygons():
    closure_service = _mock_closure_service([])
    spatial_service = _real_spatial_service()

    cm, mock_post = _patch_post(response=_mock_response())
    with cm:
        _, excluded = await get_route_with_closures(
            _START, _END, RoutingMode.AUTO, closure_service, spatial_service
        )
    assert excluded == 0
    assert "exclude_polygons" not in mock_post.call_args.kwargs["json"]


@pytest.mark.asyncio
async def test_timeout_maps_to_504():
    closure_service = _mock_closure_service([])
    cm, _ = _patch_post(side_effect=httpx.TimeoutException("boom"))
    with cm:
        with pytest.raises(RoutingError) as exc:
            await get_route_with_closures(
                _START, _END, RoutingMode.AUTO, closure_service, _real_spatial_service()
            )
    assert exc.value.status_code == 504


@pytest.mark.asyncio
async def test_upstream_400_maps_to_400():
    closure_service = _mock_closure_service([])
    cm, _ = _patch_post(response=_mock_response(status_code=400, text="bad"))
    with cm:
        with pytest.raises(RoutingError) as exc:
            await get_route_with_closures(
                _START, _END, RoutingMode.AUTO, closure_service, _real_spatial_service()
            )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_upstream_500_maps_to_502():
    closure_service = _mock_closure_service([])
    cm, _ = _patch_post(response=_mock_response(status_code=503, text="down"))
    with cm:
        with pytest.raises(RoutingError) as exc:
            await get_route_with_closures(
                _START, _END, RoutingMode.AUTO, closure_service, _real_spatial_service()
            )
    assert exc.value.status_code == 502


# --------------------------------------------------------------------------- #
# Endpoint test (ASGI transport, mocked Valhalla + DB)
# --------------------------------------------------------------------------- #
_ROUTE_BODY = {
    "start": {"type": "Point", "coordinates": [8.5417, 47.3769]},
    "end": {"type": "Point", "coordinates": [8.5500, 47.3800]},
    "mode": "auto",
}


async def _post_route():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post("/api/v1/routing/closure-aware", json=_ROUTE_BODY)


@pytest.mark.asyncio
async def test_endpoint_returns_trip_passthrough():
    # Patch the service helper the endpoint calls, so we don't also patch the
    # ASGI test client's own httpx.AsyncClient.post.
    app.dependency_overrides[get_db] = lambda: MagicMock()
    try:
        with patch(
            "app.api.routing.get_route_with_closures",
            new=AsyncMock(return_value=(_VALHALLA_OK, 0)),
        ):
            resp = await _post_route()
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["trip"] == _VALHALLA_OK
    assert data["excluded_closures"] == 0


@pytest.mark.asyncio
async def test_endpoint_timeout_maps_to_504():
    app.dependency_overrides[get_db] = lambda: MagicMock()
    try:
        with patch(
            "app.api.routing.get_route_with_closures",
            new=AsyncMock(side_effect=RoutingError(504, "timed out")),
        ):
            resp = await _post_route()
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 504, resp.text
    # Custom HTTPException handler (app.main) reshapes detail -> "message".
    assert resp.json()["message"] == "timed out"


# --------------------------------------------------------------------------- #
# Integration tests (full ASGI path, real service, mocked Valhalla + DB)
# --------------------------------------------------------------------------- #

_ALL_MODES = ["auto", "bicycle", "pedestrian"]


def _patch_service_valhalla(response):
    """Patch the AsyncClient used *inside* routing_service so the outbound
    Valhalla POST is mocked without touching the ASGI test client.

    Returns ``(context_manager, mock_post)`` where ``mock_post`` captures the
    request body sent to Valhalla. The patched ``AsyncClient`` is an async
    context manager (``async with httpx.AsyncClient(...) as client``).
    """
    mock_post = AsyncMock(return_value=response)
    mock_client = MagicMock()
    mock_client.post = mock_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    cm = patch(
        "app.services.routing_service.httpx.AsyncClient",
        return_value=mock_client,
    )
    return cm, mock_post


async def _post_route_mode(mode: str):
    """POST a route request for ``mode`` through the ASGI app."""
    body = {**_ROUTE_BODY, "mode": mode}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post("/api/v1/routing/closure-aware", json=body)


def _patch_closures(closures):
    """Patch ClosureService as used by the routing endpoint so
    ``get_active_closures_for_mode`` returns ``closures``."""
    mock_service = MagicMock()
    mock_service.get_active_closures_for_mode.return_value = closures
    return patch("app.api.routing.ClosureService", return_value=mock_service)


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", _ALL_MODES)
async def test_endpoint_sends_correct_costing_per_mode(mode):
    """Each mode must reach Valhalla with the matching costing value."""
    app.dependency_overrides[get_db] = lambda: MagicMock()
    cm, mock_post = _patch_service_valhalla(_mock_response())
    try:
        with _patch_closures([]), cm:
            resp = await _post_route_mode(mode)
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200, resp.text
    body = mock_post.call_args.kwargs["json"]
    assert body["costing"] == mode


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", _ALL_MODES)
async def test_endpoint_sends_exclude_polygons_when_closures_active(mode):
    """Active closures are buffered and sent to Valhalla as exclude_polygons,
    and the response reports them, for every mode."""
    app.dependency_overrides[get_db] = lambda: MagicMock()
    cm, mock_post = _patch_service_valhalla(_mock_response())
    try:
        with _patch_closures([_LINE_CLOSURE]), cm:
            resp = await _post_route_mode(mode)
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200, resp.text
    assert resp.json()["excluded_closures"] == 1

    body = mock_post.call_args.kwargs["json"]
    assert body["costing"] == mode
    assert len(body["exclude_polygons"]) == 1
    ring = body["exclude_polygons"][0]
    assert len(ring) >= 4  # closed ring
    assert all(8.0 < pt[0] < 9.0 and 47.0 < pt[1] < 48.0 for pt in ring)


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", _ALL_MODES)
async def test_endpoint_no_closures_omits_exclude_polygons(mode):
    """With no active closures, no exclude_polygons are sent and the response
    reports zero excluded closures, for every mode."""
    app.dependency_overrides[get_db] = lambda: MagicMock()
    cm, mock_post = _patch_service_valhalla(_mock_response())
    try:
        with _patch_closures([]), cm:
            resp = await _post_route_mode(mode)
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200, resp.text
    assert resp.json()["excluded_closures"] == 0

    body = mock_post.call_args.kwargs["json"]
    assert body["costing"] == mode
    assert "exclude_polygons" not in body


def test_valhalla_image_pinned_to_3_5_1():
    """Version contract: the integration tests assume Valhalla 3.5.1, which is
    the image tag pinned in docker-compose.yml. (There is no /status endpoint or
    version-check code in the backend to assert against at runtime.)"""
    from pathlib import Path

    compose = Path(__file__).resolve().parents[1] / "docker-compose.yml"
    assert compose.is_file(), f"docker-compose.yml not found at {compose}"
    text = compose.read_text()
    assert "valhalla:3.5.1" in text, (
        "Valhalla image is no longer pinned to 3.5.1 in docker-compose.yml; "
        "the routing integration tests assume that version."
    )
