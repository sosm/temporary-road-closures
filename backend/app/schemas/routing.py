"""
Pydantic schemas for closure-aware routing requests and responses.
"""

from enum import Enum

from pydantic import BaseModel, Field, field_validator

from app.schemas.closure import GeoJSONGeometry


class RoutingMode(str, Enum):
    """
    Transportation modes accepted by the routing endpoint.

    These mirror the frontend's ``TransportationMode``
    (frontend/utils/routing-utils.ts), NOT the DB ``TransportMode`` enum on the
    Closure model. The mapping from DB transport modes / closure types to these
    routing modes lives in ``app.services.routing_filters``.
    """

    AUTO = "auto"
    BICYCLE = "bicycle"
    PEDESTRIAN = "pedestrian"


class RouteRequest(BaseModel):
    """Request body for ``POST /api/v1/routing/closure-aware``."""

    start: GeoJSONGeometry = Field(
        ..., description="Origin as a GeoJSON Point ([lon, lat], WGS84)"
    )
    end: GeoJSONGeometry = Field(
        ..., description="Destination as a GeoJSON Point ([lon, lat], WGS84)"
    )
    mode: RoutingMode = Field(
        RoutingMode.AUTO,
        description=(
            "Transportation mode (Valhalla costing): auto | bicycle | "
            "pedestrian. Defaults to auto."
        ),
    )

    @field_validator("start", "end")
    @classmethod
    def must_be_point(cls, v: GeoJSONGeometry) -> GeoJSONGeometry:
        """Start and end must be GeoJSON Points (coordinate ranges already
        validated by GeoJSONGeometry)."""
        if v.type != "Point":
            raise ValueError("start and end must be GeoJSON Point geometries")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "start": {"type": "Point", "coordinates": [8.5417, 47.3769]},
                "end": {"type": "Point", "coordinates": [8.5500, 47.3800]},
                "mode": "auto",
            }
        }
    }


class RouteResponse(BaseModel):
    """Response body for ``POST /api/v1/routing/closure-aware``.

    ``trip`` is Valhalla's raw trip object (the inner ``trip`` from Valhalla's
    response, i.e. ``legs``/``summary``/``locations``…), passed through untyped;
    defining the full trip/leg/maneuver schema is intentionally out of scope (it
    is brittle against Valhalla version changes). ``excluded_closures`` reports
    how many active closures were buffered and sent to Valhalla as
    ``exclude_polygons``.
    """

    trip: dict = Field(
        ..., description="Valhalla trip object (legs, summary, locations, …)"
    )
    excluded_closures: int = Field(
        ..., description="Number of active closures excluded from the route"
    )
