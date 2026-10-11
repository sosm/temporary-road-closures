"""
API endpoints for importing 3rd party closure data.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from typing import Optional
import json
import csv
import io

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_moderator
from app.models.user import User
from app.schemas.import_data import (
    ImportFormat,
    ImportOptions,
    ImportResult,
    GeoJSONImportData,
)
from app.services.import_service import ImportService
from app.core.exceptions import ValidationException


router = APIRouter()


@router.post(
    "/",
    response_model=ImportResult,
    status_code=status.HTTP_200_OK,
    summary="Import 3rd party closure data",
    description="Import closure data from various 3rd party formats.",
)
async def import_closures(
    file: UploadFile = File(..., description="Data file to import"),
    format: ImportFormat = Form(..., description="Data format"),
    attribution: str = Form(..., description="Attribution for data source"),
    data_license: Optional[str] = Form(None, description="Data license"),
    source: str = Form(..., description="Source name"),
    default_confidence: int = Form(5, ge=1, le=10, description="Default confidence level"),
    skip_validation: bool = Form(False, description="Skip geometry validation"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Import closure data from various 3rd party formats.

    **Supported Formats:**
    - `geojson`: GeoJSON FeatureCollection
    - `csv`: CSV with required columns
    - `waze`: Waze Traffic API format
    - `here`: HERE Traffic API format
    - `tomtom`: TomTom Traffic API format
    - `ost`: OST prealigner GeoJSON feed

    **Required Fields:**
    - `attribution`: Attribution string for the data source
    - `source`: Name of the data source
    - `format`: Data format

    **CSV Format Requirements:**
    The CSV file must have the following columns:
    - `description`: Closure description
    - `start_time`: Start time (ISO 8601 format)
    - `end_time`: End time (ISO 8601 format, optional)
    - `closure_type`: Type of closure (construction, accident, etc.)
    - `transport_mode`: Transport mode affected (optional, defaults to 'all')
    - `geometry_type`: point, linestring, or polygon
    - `coordinates`: Coordinates as JSON array
    - `is_bidirectional`: true/false (optional, defaults to true)
    - `confidence_level`: 1-10 (optional)

    **GeoJSON Format Requirements:**
    Must be a valid GeoJSON FeatureCollection with features containing:
    - `geometry`: Point, LineString, or Polygon
    - `properties`: Object with closure metadata (description, start_time, etc.)

    Returns import result with count of successful imports and any errors.
    """
    try:
        # Read file content
        content = await file.read()

        # Create import options
        options = ImportOptions(
            format=format,
            attribution=attribution,
            data_license=data_license,
            source=source,
            default_confidence=default_confidence,
            skip_validation=skip_validation,
        )

        # Create import service
        import_service = ImportService(db)

        # Import data based on format.
        # OpenLR encoding map-matches against Valhalla, so this must not run on
        # the event loop; run_in_threadpool also gives the encoder a worker
        # thread it can bridge back to async from, and keeps the loop free to
        # serve other requests for the duration of the import.
        result = await run_in_threadpool(
            import_service.import_data,
            content=content,
            options=options,
            user_id=current_user.id,
        )

        return result

    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}",
        )


@router.post(
    "/geojson",
    response_model=ImportResult,
    status_code=status.HTTP_200_OK,
    summary="Import GeoJSON closure data",
    description="Import closure data from GeoJSON FeatureCollection.",
)
async def import_geojson(
    data: GeoJSONImportData,
    attribution: str = Form(..., description="Attribution for data source"),
    data_license: Optional[str] = Form(None, description="Data license"),
    source: str = Form(..., description="Source name"),
    default_confidence: int = Form(5, ge=1, le=10, description="Default confidence level"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Import closure data from GeoJSON FeatureCollection.

    Each feature should have:
    - `geometry`: Point, LineString, or Polygon
    - `properties`: Object with:
      - `description`: Closure description (required)
      - `start_time`: ISO 8601 datetime (required)
      - `end_time`: ISO 8601 datetime (optional)
      - `closure_type`: Type of closure (required)
      - `transport_mode`: Transport mode affected (optional)
      - `is_bidirectional`: Boolean (optional)
      - `confidence_level`: 1-10 (optional)

    Returns import result with count of successful imports and any errors.
    """
    try:
        options = ImportOptions(
            format=ImportFormat.GEOJSON,
            attribution=attribution,
            data_license=data_license,
            source=source,
            default_confidence=default_confidence,
        )

        import_service = ImportService(db)
        # See the note in import_closures: encoding must not run on the event loop.
        result = await run_in_threadpool(
            import_service.import_geojson_data,
            data=data.dict(),
            options=options,
            user_id=current_user.id,
        )

        return result

    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GeoJSON import failed: {str(e)}",
        )


@router.get(
    "/template/csv",
    summary="Download CSV template",
    description="Download a CSV template for importing closure data.",
)
async def get_csv_template():
    """
    Download a CSV template for importing closure data.

    Returns a CSV file with the required columns and example data.
    """
    from fastapi.responses import StreamingResponse

    # Create CSV template
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow(
        [
            "description",
            "start_time",
            "end_time",
            "closure_type",
            "transport_mode",
            "geometry_type",
            "coordinates",
            "is_bidirectional",
            "confidence_level",
        ]
    )

    # Write example rows
    writer.writerow(
        [
            "Road construction on Main St",
            "2025-01-15T08:00:00Z",
            "2025-01-15T18:00:00Z",
            "construction",
            "all",
            "linestring",
            '[[-87.6298, 41.8781], [-87.6290, 41.8785]]',
            "true",
            "9",
        ]
    )
    writer.writerow(
        [
            "Accident at intersection",
            "2025-01-14T10:30:00Z",
            "2025-01-14T12:00:00Z",
            "accident",
            "car",
            "point",
            "[-87.6201, 41.8902]",
            "false",
            "7",
        ]
    )

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=closure_import_template.csv"},
    )
