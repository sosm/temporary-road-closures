"""
Service for importing 3rd party closure data.
"""

from sqlalchemy.orm import Session
from typing import Dict, Any, List
import json
import csv
import io
from datetime import datetime
import logging

from app.schemas.import_data import ImportFormat, ImportOptions, ImportResult
from app.schemas.closure import ClosureCreate, GeoJSONGeometry
from app.models.closure import ClosureType, TransportMode
from app.services.closure_service import ClosureService
from app.core.exceptions import ValidationException

logger = logging.getLogger(__name__)


class ImportService:
    """
    Service for importing closure data from various formats.
    """

    def __init__(self, db: Session):
        self.db = db
        self.closure_service = ClosureService(db)

    def import_data(
        self, content: bytes, options: ImportOptions, user_id: int
    ) -> ImportResult:
        """
        Import closure data from file content.

        Synchronous by design: importing map-matches each closure against
        Valhalla to derive its OpenLR code, which cannot run on the event
        loop. Call via ``run_in_threadpool`` (see ``api/import_data.py``).

        Args:
            content: File content as bytes
            options: Import options
            user_id: User ID performing the import

        Returns:
            ImportResult: Import result with statistics
        """
        # Decode content
        try:
            text_content = content.decode("utf-8")
        except UnicodeDecodeError:
            raise ValidationException("File must be UTF-8 encoded")

        # Route to appropriate import method based on format
        if options.format == ImportFormat.GEOJSON:
            data = json.loads(text_content)
            return self.import_geojson_data(data, options, user_id)
        elif options.format == ImportFormat.CSV:
            return self.import_csv_data(text_content, options, user_id)
        elif options.format == ImportFormat.WAZE:
            data = json.loads(text_content)
            return self.import_waze_data(data, options, user_id)
        elif options.format == ImportFormat.HERE:
            data = json.loads(text_content)
            return self.import_here_data(data, options, user_id)
        elif options.format == ImportFormat.TOMTOM:
            data = json.loads(text_content)
            return self.import_tomtom_data(data, options, user_id)
        else:
            raise ValidationException(f"Unsupported format: {options.format}")

    def import_geojson_data(
        self, data: Dict[str, Any], options: ImportOptions, user_id: int
    ) -> ImportResult:
        """
        Import closure data from GeoJSON FeatureCollection.

        Args:
            data: GeoJSON FeatureCollection
            options: Import options
            user_id: User ID

        Returns:
            ImportResult: Import result
        """
        if data.get("type") != "FeatureCollection":
            raise ValidationException("GeoJSON must be a FeatureCollection")

        features = data.get("features", [])
        total_records = len(features)
        imported_count = 0
        failed_count = 0
        errors = []
        closure_ids = []

        for idx, feature in enumerate(features):
            try:
                # Extract geometry and properties
                geometry = feature.get("geometry")
                properties = feature.get("properties", {})

                if not geometry:
                    raise ValueError(f"Feature {idx} missing geometry")

                # Create closure data
                closure_data = self._create_closure_from_geojson_feature(
                    geometry, properties, options
                )

                # Create closure
                closure = self.closure_service.create_closure(closure_data, user_id)
                closure_ids.append(closure.id)
                imported_count += 1

            except Exception as e:
                failed_count += 1
                error_msg = f"Feature {idx}: {str(e)}"
                errors.append(error_msg)
                logger.warning(f"Failed to import feature {idx}: {str(e)}")

        return ImportResult(
            success=failed_count == 0,
            total_records=total_records,
            imported_count=imported_count,
            failed_count=failed_count,
            errors=errors,
            closure_ids=closure_ids,
        )

    def import_csv_data(
        self, content: str, options: ImportOptions, user_id: int
    ) -> ImportResult:
        """
        Import closure data from CSV.

        Args:
            content: CSV content as string
            options: Import options
            user_id: User ID

        Returns:
            ImportResult: Import result
        """
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
        total_records = len(rows)
        imported_count = 0
        failed_count = 0
        errors = []
        closure_ids = []

        for idx, row in enumerate(rows):
            try:
                closure_data = self._create_closure_from_csv_row(row, options)
                closure = self.closure_service.create_closure(closure_data, user_id)
                closure_ids.append(closure.id)
                imported_count += 1

            except Exception as e:
                failed_count += 1
                error_msg = f"Row {idx + 2}: {str(e)}"  # +2 for header and 0-indexing
                errors.append(error_msg)
                logger.warning(f"Failed to import row {idx + 2}: {str(e)}")

        return ImportResult(
            success=failed_count == 0,
            total_records=total_records,
            imported_count=imported_count,
            failed_count=failed_count,
            errors=errors,
            closure_ids=closure_ids,
        )

    def import_waze_data(
        self, data: Dict[str, Any], options: ImportOptions, user_id: int
    ) -> ImportResult:
        """
        Import closure data from Waze Traffic API format.

        Args:
            data: Waze API response data
            options: Import options
            user_id: User ID

        Returns:
            ImportResult: Import result
        """
        alerts = data.get("alerts", [])
        total_records = len(alerts)
        imported_count = 0
        failed_count = 0
        errors = []
        closure_ids = []

        for idx, alert in enumerate(alerts):
            try:
                # Only import road closures
                if alert.get("type") not in ["ROAD_CLOSED", "ROAD_CLOSED_HAZARD"]:
                    continue

                closure_data = self._create_closure_from_waze_alert(alert, options)
                closure = self.closure_service.create_closure(closure_data, user_id)
                closure_ids.append(closure.id)
                imported_count += 1

            except Exception as e:
                failed_count += 1
                error_msg = f"Alert {idx}: {str(e)}"
                errors.append(error_msg)
                logger.warning(f"Failed to import Waze alert {idx}: {str(e)}")

        return ImportResult(
            success=failed_count == 0,
            total_records=total_records,
            imported_count=imported_count,
            failed_count=failed_count,
            errors=errors,
            closure_ids=closure_ids,
        )

    def import_here_data(
        self, data: Dict[str, Any], options: ImportOptions, user_id: int
    ) -> ImportResult:
        """
        Import closure data from HERE Traffic API format.

        Args:
            data: HERE API response data
            options: Import options
            user_id: User ID

        Returns:
            ImportResult: Import result
        """
        incidents = data.get("TRAFFIC_ITEMS", {}).get("TRAFFIC_ITEM", [])
        if not isinstance(incidents, list):
            incidents = [incidents]

        total_records = len(incidents)
        imported_count = 0
        failed_count = 0
        errors = []
        closure_ids = []

        for idx, incident in enumerate(incidents):
            try:
                closure_data = self._create_closure_from_here_incident(
                    incident, options
                )
                closure = self.closure_service.create_closure(closure_data, user_id)
                closure_ids.append(closure.id)
                imported_count += 1

            except Exception as e:
                failed_count += 1
                error_msg = f"Incident {idx}: {str(e)}"
                errors.append(error_msg)
                logger.warning(f"Failed to import HERE incident {idx}: {str(e)}")

        return ImportResult(
            success=failed_count == 0,
            total_records=total_records,
            imported_count=imported_count,
            failed_count=failed_count,
            errors=errors,
            closure_ids=closure_ids,
        )

    def import_tomtom_data(
        self, data: Dict[str, Any], options: ImportOptions, user_id: int
    ) -> ImportResult:
        """
        Import closure data from TomTom Traffic API format.

        Args:
            data: TomTom API response data
            options: Import options
            user_id: User ID

        Returns:
            ImportResult: Import result
        """
        incidents = data.get("incidents", [])
        total_records = len(incidents)
        imported_count = 0
        failed_count = 0
        errors = []
        closure_ids = []

        for idx, incident in enumerate(incidents):
            try:
                closure_data = self._create_closure_from_tomtom_incident(
                    incident, options
                )
                closure = self.closure_service.create_closure(closure_data, user_id)
                closure_ids.append(closure.id)
                imported_count += 1

            except Exception as e:
                failed_count += 1
                error_msg = f"Incident {idx}: {str(e)}"
                errors.append(error_msg)
                logger.warning(f"Failed to import TomTom incident {idx}: {str(e)}")

        return ImportResult(
            success=failed_count == 0,
            total_records=total_records,
            imported_count=imported_count,
            failed_count=failed_count,
            errors=errors,
            closure_ids=closure_ids,
        )

    def _create_closure_from_geojson_feature(
        self, geometry: Dict[str, Any], properties: Dict[str, Any], options: ImportOptions
    ) -> ClosureCreate:
        """Create ClosureCreate from GeoJSON feature."""
        # Validate required fields
        if "description" not in properties:
            raise ValueError("Missing required field: description")
        if "start_time" not in properties:
            raise ValueError("Missing required field: start_time")
        if "closure_type" not in properties:
            raise ValueError("Missing required field: closure_type")

        # Parse dates
        start_time = self._parse_datetime(properties["start_time"])
        end_time = (
            self._parse_datetime(properties["end_time"])
            if properties.get("end_time")
            else None
        )

        # Parse closure type
        closure_type = self._parse_closure_type(properties["closure_type"])

        # Parse transport mode
        transport_mode = self._parse_transport_mode(
            properties.get("transport_mode", "all")
        )

        return ClosureCreate(
            geometry=GeoJSONGeometry(**geometry),
            description=properties["description"],
            closure_type=closure_type,
            start_time=start_time,
            end_time=end_time,
            source=options.source,
            confidence_level=properties.get("confidence_level", options.default_confidence),
            is_bidirectional=properties.get("is_bidirectional", True),
            transport_mode=transport_mode,
            attribution=options.attribution,
            data_license=options.data_license,
        )

    def _create_closure_from_csv_row(
        self, row: Dict[str, str], options: ImportOptions
    ) -> ClosureCreate:
        """Create ClosureCreate from CSV row."""
        # Parse coordinates
        coordinates = json.loads(row["coordinates"])
        geometry_type = row["geometry_type"].lower()

        if geometry_type == "point":
            geometry = GeoJSONGeometry(type="Point", coordinates=coordinates)
        elif geometry_type == "linestring":
            geometry = GeoJSONGeometry(type="LineString", coordinates=coordinates)
        elif geometry_type == "polygon":
            geometry = GeoJSONGeometry(type="Polygon", coordinates=coordinates)
        else:
            raise ValueError(f"Invalid geometry type: {geometry_type}")

        # Parse dates
        start_time = self._parse_datetime(row["start_time"])
        end_time = self._parse_datetime(row["end_time"]) if row.get("end_time") else None

        # Parse closure type
        closure_type = self._parse_closure_type(row["closure_type"])

        # Parse transport mode
        transport_mode = self._parse_transport_mode(row.get("transport_mode", "all"))

        return ClosureCreate(
            geometry=geometry,
            description=row["description"],
            closure_type=closure_type,
            start_time=start_time,
            end_time=end_time,
            source=options.source,
            confidence_level=int(row.get("confidence_level", options.default_confidence)),
            is_bidirectional=row.get("is_bidirectional", "true").lower() == "true",
            transport_mode=transport_mode,
            attribution=options.attribution,
            data_license=options.data_license,
        )

    def _create_closure_from_waze_alert(
        self, alert: Dict[str, Any], options: ImportOptions
    ) -> ClosureCreate:
        """Create ClosureCreate from Waze alert."""
        # Waze provides lat/lon as point
        location = alert.get("location", {})
        geometry = GeoJSONGeometry(
            type="Point", coordinates=[location.get("x"), location.get("y")]
        )

        # Parse timestamp
        start_time = datetime.fromtimestamp(alert.get("pubMillis", 0) / 1000)

        return ClosureCreate(
            geometry=geometry,
            description=alert.get("street", "Road closure reported via Waze"),
            closure_type=ClosureType.OTHER,
            start_time=start_time,
            end_time=None,  # Waze doesn't provide end times
            source=options.source,
            confidence_level=options.default_confidence,
            is_bidirectional=True,
            transport_mode=TransportMode.CAR,  # Waze is primarily for cars
            attribution=options.attribution,
            data_license=options.data_license,
        )

    def _create_closure_from_here_incident(
        self, incident: Dict[str, Any], options: ImportOptions
    ) -> ClosureCreate:
        """Create ClosureCreate from HERE incident."""
        # HERE provides geometry as shape points
        location = incident.get("LOCATION", {})
        shape = location.get("GEOLOC", {}).get("GEOMETRY", {}).get("SHAPES", {}).get("SHP", [])

        if not shape:
            raise ValueError("No geometry in HERE incident")

        # Parse coordinates from shape (format: "lat,lon lat,lon")
        coords = []
        for point in shape[0].get("value", "").split(" "):
            lat, lon = map(float, point.split(","))
            coords.append([lon, lat])  # GeoJSON uses [lon, lat]

        # Determine geometry type
        if len(coords) == 1:
            geometry = GeoJSONGeometry(type="Point", coordinates=coords[0])
        else:
            geometry = GeoJSONGeometry(type="LineString", coordinates=coords)

        # Parse timestamps
        start_time = self._parse_datetime(incident.get("START_TIME", datetime.now().isoformat()))
        end_time = self._parse_datetime(incident.get("END_TIME")) if incident.get("END_TIME") else None

        return ClosureCreate(
            geometry=geometry,
            description=incident.get("TRAFFIC_ITEM_DESCRIPTION", [{}])[0].get("value", "Road incident"),
            closure_type=ClosureType.OTHER,
            start_time=start_time,
            end_time=end_time,
            source=options.source,
            confidence_level=options.default_confidence,
            is_bidirectional=True,
            transport_mode=TransportMode.ALL,
            attribution=options.attribution,
            data_license=options.data_license,
        )

    def _create_closure_from_tomtom_incident(
        self, incident: Dict[str, Any], options: ImportOptions
    ) -> ClosureCreate:
        """Create ClosureCreate from TomTom incident."""
        # TomTom provides geometry as point or polyline
        geometry_data = incident.get("geometry", {})
        geom_type = geometry_data.get("type")

        if geom_type == "Point":
            coords = geometry_data.get("coordinates")
            geometry = GeoJSONGeometry(type="Point", coordinates=coords)
        elif geom_type == "LineString":
            coords = geometry_data.get("coordinates")
            geometry = GeoJSONGeometry(type="LineString", coordinates=coords)
        else:
            raise ValueError(f"Unsupported TomTom geometry type: {geom_type}")

        # Parse timestamps
        start_time = self._parse_datetime(incident.get("startTime", datetime.now().isoformat()))
        end_time = self._parse_datetime(incident.get("endTime")) if incident.get("endTime") else None

        return ClosureCreate(
            geometry=geometry,
            description=incident.get("description", "Road incident from TomTom"),
            closure_type=ClosureType.OTHER,
            start_time=start_time,
            end_time=end_time,
            source=options.source,
            confidence_level=options.default_confidence,
            is_bidirectional=True,
            transport_mode=TransportMode.ALL,
            attribution=options.attribution,
            data_license=options.data_license,
        )

    def _parse_datetime(self, dt_str: str) -> datetime:
        """Parse datetime string."""
        try:
            # Try ISO format
            return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except ValueError:
            # Try common formats
            for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S"]:
                try:
                    return datetime.strptime(dt_str, fmt)
                except ValueError:
                    continue
            raise ValueError(f"Cannot parse datetime: {dt_str}")

    def _parse_closure_type(self, type_str: str) -> ClosureType:
        """Parse closure type string."""
        type_str = type_str.lower().strip()
        try:
            return ClosureType(type_str)
        except ValueError:
            # Try to match partial strings
            for ct in ClosureType:
                if ct.value in type_str or type_str in ct.value:
                    return ct
            # Default to OTHER
            return ClosureType.OTHER

    def _parse_transport_mode(self, mode_str: str) -> TransportMode:
        """Parse transport mode string."""
        mode_str = mode_str.lower().strip()
        try:
            return TransportMode(mode_str)
        except ValueError:
            # Default to ALL
            return TransportMode.ALL
