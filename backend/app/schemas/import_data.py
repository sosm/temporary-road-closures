"""
Pydantic schemas for 3rd party data import.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ImportFormat(str, Enum):
    """Supported import formats."""

    GEOJSON = "geojson"
    CSV = "csv"
    WAZE = "waze"
    HERE = "here"
    TOMTOM = "tomtom"
    OST = "ost"


class ImportOptions(BaseModel):
    """Options for data import."""

    format: ImportFormat = Field(..., description="Data format")
    attribution: str = Field(
        ..., min_length=1, max_length=500, description="Attribution for the data source"
    )
    data_license: Optional[str] = Field(
        None, max_length=100, description="License for the data"
    )
    source: str = Field(
        ..., min_length=1, max_length=100, description="Source name"
    )
    default_confidence: int = Field(
        5, ge=1, le=10, description="Default confidence level for imported closures"
    )
    skip_validation: bool = Field(
        False, description="Skip geometry validation (not recommended)"
    )


class ImportResult(BaseModel):
    """Result of an import operation."""

    success: bool = Field(..., description="Whether import succeeded")
    total_records: int = Field(..., description="Total records in import file")
    imported_count: int = Field(..., description="Number of successfully imported closures")
    failed_count: int = Field(..., description="Number of failed imports")
    # Distinct from failed_count: a record the feed marks as deleted is valid
    # input with nothing to do, not malformed data.
    skipped_count: int = Field(0, description="Number of records skipped, not failed")
    errors: List[str] = Field(default_factory=list, description="List of error messages")
    closure_ids: List[int] = Field(
        default_factory=list, description="IDs of created closures"
    )


class GeoJSONImportData(BaseModel):
    """GeoJSON import data structure."""

    type: str = Field(..., description="Must be 'FeatureCollection'")
    features: List[Dict[str, Any]] = Field(..., description="List of GeoJSON features")

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        """Validate that type is FeatureCollection."""
        if v != "FeatureCollection":
            raise ValueError("GeoJSON type must be 'FeatureCollection'")
        return v


class CSVImportRow(BaseModel):
    """CSV row structure for import."""

    description: str = Field(..., description="Closure description")
    start_time: str = Field(..., description="Start time (ISO 8601)")
    end_time: Optional[str] = Field(None, description="End time (ISO 8601)")
    closure_type: str = Field(..., description="Closure type")
    transport_mode: Optional[str] = Field("all", description="Transport mode affected")
    geometry_type: str = Field(..., description="point, linestring, or polygon")
    coordinates: str = Field(
        ..., description="Coordinates as JSON array or WKT string"
    )
    is_bidirectional: Optional[bool] = Field(True, description="Bidirectional flag")
    confidence_level: Optional[int] = Field(None, ge=1, le=10, description="Confidence")


class WazeImportData(BaseModel):
    """Waze Traffic API import data structure."""

    alerts: List[Dict[str, Any]] = Field(..., description="List of Waze alerts")


class HEREImportData(BaseModel):
    """HERE Traffic API import data structure."""

    incidents: List[Dict[str, Any]] = Field(..., description="List of HERE incidents")
