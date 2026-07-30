"""
Tests for the MVT tile query builder (issue #104 vector-tile map rendering).

``ClosureService.get_closures_tile`` builds a single raw-SQL MVT statement and
delegates execution to ``self.db.execute``. These are DB-free unit tests: they
mock ``db`` and assert the SQL shape, bound parameters, and that the
status/type/mode/temporal filters carry over exactly as in ``query_closures``.

The SQL itself is exercised against a live PostGIS instance manually; here we
lock down the filter-to-parameter contract so map tiles and the GeoJSON list
endpoint stay consistent.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.main import app
from app.services.closure_service import ClosureService


def _svc_with_mock_db():
    """A service instance whose db.execute(...).scalar() returns tile bytes."""
    svc = ClosureService.__new__(ClosureService)
    svc.db = MagicMock()
    svc.db.execute.return_value.scalar.return_value = b"\x1a\x0b"  # fake MVT bytes
    return svc


def _captured(svc):
    """Return (compiled_sql_text, params) from the single db.execute call."""
    args, kwargs = svc.db.execute.call_args
    sql_clause, params = args[0], args[1]
    return str(sql_clause), params


class TestTileParams:
    """z/x/y are always bound; return value is coerced to bytes."""

    def test_tile_coords_bound(self):
        svc = _svc_with_mock_db()
        svc.get_closures_tile(z=10, x=262, y=380, valid_only=False)
        _sql, params = _captured(svc)
        assert params["z"] == 10
        assert params["x"] == 262
        assert params["y"] == 380

    def test_returns_bytes(self):
        svc = _svc_with_mock_db()
        out = svc.get_closures_tile(z=0, x=0, y=0, valid_only=False)
        assert out == b"\x1a\x0b"

    def test_empty_tile_returns_empty_bytes(self):
        svc = _svc_with_mock_db()
        svc.db.execute.return_value.scalar.return_value = None
        out = svc.get_closures_tile(z=0, x=0, y=0, valid_only=False)
        assert out == b""


class TestSpatialPrefilter:
    """The GIST-indexed && prefilter and tile envelope must be present."""

    def test_uses_gist_prefilter_and_tile_envelope(self):
        svc = _svc_with_mock_db()
        svc.get_closures_tile(z=5, x=1, y=2, valid_only=False)
        sql, _ = _captured(svc)
        assert "ST_TileEnvelope(:z, :x, :y)" in sql
        assert "c.geometry && bounds.geom_4326" in sql  # 4326 keeps GIST usable
        assert "ST_AsMVTGeom(" in sql
        assert "ST_AsMVT(" in sql


class TestFilterCarryOver:
    """Filters must map 1:1 to query_closures semantics."""

    def test_valid_only_adds_status_and_time_window(self):
        svc = _svc_with_mock_db()
        svc.get_closures_tile(z=0, x=0, y=0, valid_only=True)
        sql, params = _captured(svc)
        assert "c.status = 'active'" in sql
        assert "c.start_time <= :now" in sql
        assert "c.end_time IS NULL OR c.end_time > :now" in sql
        assert isinstance(params["now"], datetime)

    def test_valid_only_false_omits_status_window(self):
        svc = _svc_with_mock_db()
        svc.get_closures_tile(z=0, x=0, y=0, valid_only=False)
        sql, params = _captured(svc)
        assert "c.status = 'active'" not in sql
        assert "now" not in params

    def test_closure_type_filter(self):
        svc = _svc_with_mock_db()
        svc.get_closures_tile(
            z=0, x=0, y=0, valid_only=False, closure_type="construction"
        )
        sql, params = _captured(svc)
        assert "c.closure_type = :closure_type" in sql
        assert params["closure_type"] == "construction"

    def test_transport_mode_filter(self):
        svc = _svc_with_mock_db()
        svc.get_closures_tile(z=0, x=0, y=0, valid_only=False, transport_mode="bicycle")
        sql, params = _captured(svc)
        assert "c.transport_mode = :transport_mode" in sql
        assert params["transport_mode"] == "bicycle"

    def test_is_bidirectional_filter_false_is_applied(self):
        # False is a real filter value, not "unset" — must still be bound.
        svc = _svc_with_mock_db()
        svc.get_closures_tile(z=0, x=0, y=0, valid_only=False, is_bidirectional=False)
        sql, params = _captured(svc)
        assert "c.is_bidirectional = :is_bidirectional" in sql
        assert params["is_bidirectional"] is False

    def test_temporal_filters(self):
        svc = _svc_with_mock_db()
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        end = datetime(2026, 2, 1, tzinfo=timezone.utc)
        svc.get_closures_tile(
            z=0, x=0, y=0, valid_only=False, start_time=start, end_time=end
        )
        sql, params = _captured(svc)
        assert "c.start_time >= :start_time" in sql
        assert "c.end_time IS NULL OR c.end_time <= :end_time" in sql
        assert params["start_time"] == start
        assert params["end_time"] == end

    def test_no_filters_only_binds_tile_coords(self):
        svc = _svc_with_mock_db()
        svc.get_closures_tile(z=3, x=4, y=5, valid_only=False)
        _sql, params = _captured(svc)
        assert set(params.keys()) == {"z", "x", "y"}


class TestTileCacheHeaders:
    """Cache-Control must be present on both the 200 and 204 tile paths.

    HTTP-level tests over the ASGI app; service render is mocked, so no DB is touched.
    Asserts the literal value, not the constant, so a stray edit to the constant is caught.
    """

    _URL = "/api/v1/closures/tiles/10/262/380.mvt"
    _EXPECTED = "public, max-age=300"

    async def _get_tile(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get(self._URL)

    @pytest.mark.asyncio
    async def test_cache_control_on_200(self):
        app.dependency_overrides[get_db] = lambda: MagicMock()
        try:
            with patch(
                "app.api.closures.ClosureService.get_closures_tile",
                return_value=b"\x1a\x0b",  # non-empty tile -> 200
            ):
                resp = await self._get_tile()
        finally:
            app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 200, resp.text
        assert resp.headers["cache-control"] == self._EXPECTED

    @pytest.mark.asyncio
    async def test_cache_control_on_204(self):
        app.dependency_overrides[get_db] = lambda: MagicMock()
        try:
            with patch(
                "app.api.closures.ClosureService.get_closures_tile",
                return_value=b"",  # empty tile -> 204
            ):
                resp = await self._get_tile()
        finally:
            app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 204
        assert resp.headers["cache-control"] == self._EXPECTED
