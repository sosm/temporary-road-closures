"""
Tests for GET /api/v1/closures/types endpoint (issue #27).

Verifies that:
1. The endpoint returns HTTP 200 without authentication
2. All ClosureType enum values are present in the response
3. Each entry has the expected 'value' and 'label' keys
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.closure import ClosureType


class TestGetClosureTypes:
    """Tests for the GET /api/v1/closures/types endpoint."""

    @pytest.mark.asyncio
    async def test_returns_200_without_auth(self):
        """Endpoint is public — no authentication required."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/v1/closures/types")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_all_closure_type_values(self):
        """Every ClosureType enum member must appear in the response."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/v1/closures/types")
        data = response.json()
        returned_values = {item["value"] for item in data}
        expected_values = {ct.value for ct in ClosureType}
        assert returned_values == expected_values

    @pytest.mark.asyncio
    async def test_each_entry_has_value_and_label(self):
        """Each entry must have both 'value' and 'label' keys."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/v1/closures/types")
        for item in response.json():
            assert "value" in item, f"Missing 'value' key in {item}"
            assert "label" in item, f"Missing 'label' key in {item}"

    @pytest.mark.asyncio
    async def test_construction_type_label(self):
        """Spot-check that 'construction' has a correctly formatted label."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/v1/closures/types")
        items = {item["value"]: item["label"] for item in response.json()}
        assert items["construction"] == "Construction"
        assert items["bike_lane_closure"] == "Bike Lane Closure"
