"""
Service for importing 3rd party closure data.
"""

from sqlalchemy.orm import Session
from typing import Dict, Any, List, Tuple
import json
import csv
import html
import io
import re
from datetime import datetime, timezone
import logging

from app.schemas.import_data import ImportFormat, ImportOptions, ImportResult
from app.schemas.closure import ClosureCreate, GeoJSONGeometry
from app.models.closure import ClosureType, TransportMode
from app.services.closure_service import ClosureService
from app.core.exceptions import ValidationException

logger = logging.getLogger(__name__)

# No structured type field exists; the cause sits in the free-text "Sachlage:"
# clause, matched here as a lowercased substring. Only "baustelle" is observed
# vocabulary -- the one real sample we have. The rest are plausible German
# guesses so early unseen records degrade sensibly, and the whole table wants
# rebuilding once OST supplies a proper corpus.
OST_SACHLAGE_TYPE_MAP = {
    "baustelle": ClosureType.CONSTRUCTION,
    "bauarbeiten": ClosureType.CONSTRUCTION,
    "unfall": ClosureType.ACCIDENT,
    "veranstaltung": ClosureType.EVENT,
    "unterhalt": ClosureType.MAINTENANCE,
    "witterung": ClosureType.WEATHER,
}

OST_DEFAULT_CLOSURE_TYPE = ClosureType.OTHER

# The feed has no affected-modes field at all, so every OST closure lands as ALL
# until OST exposes one.
OST_DEFAULT_TRANSPORT_MODE = TransportMode.ALL

# comment:de reads:
#   "<Status>: <address> <-> <address>  Sachlage: <cause> Dauer: <qualifier>
#    <start> bis <end> Empfehlung: ... Empfohlene Umleitung: ..."
# The leading clause label varies with status ("Freigegeben:", ...), so the
# location pattern anchors on "Sachlage:" rather than on a fixed word.
_OST_LOCATION_RE = re.compile(r"^([^:]+):\s*(.+?)\s+Sachlage:")
_OST_SACHLAGE_RE = re.compile(r"Sachlage:\s*(.+?)\s+Dauer:")

# "23.10.2023 07:00", time optional. The qualifier between "Dauer:" and the
# first date ("voraussichtlich") is deliberately skipped, not captured.
_OST_DATETIME = r"(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?"
_OST_DAUER_RE = re.compile(
    rf"Dauer:.*?{_OST_DATETIME}\s+bis\s+{_OST_DATETIME}"
)


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
        elif options.format == ImportFormat.OST:
            data = json.loads(text_content)
            return self.import_ost_data(data, options, user_id)
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

    def import_ost_data(
        self, data: Dict[str, Any], options: ImportOptions, user_id: int
    ) -> ImportResult:
        """
        Import closure data from the OST prealigner GeoJSON feed.

        Args:
            data: GeoJSON FeatureCollection from the OST feed
            options: Import options
            user_id: User ID

        Returns:
            ImportResult: Import result
        """
        if data.get("type") != "FeatureCollection":
            raise ValidationException("OST feed must be a FeatureCollection")

        features = data.get("features", [])
        total_records = len(features)
        imported_count = 0
        failed_count = 0
        skipped_count = 0
        errors = []
        closure_ids = []

        for idx, feature in enumerate(features):
            try:
                # A deleted record is well-formed input with nothing to create.
                # Acting on it needs a stable per-closure id the feed does not
                # publish -- see the OST section of IMPORT_DATA_FORMAT.md.
                if (feature.get("properties") or {}).get("is_deleted"):
                    skipped_count += 1
                    continue

                closure_data = self._create_closure_from_ost_feature(feature, options)
                closure = self.closure_service.create_closure(closure_data, user_id)
                closure_ids.append(closure.id)
                imported_count += 1

            except Exception as e:
                failed_count += 1
                error_msg = f"Feature {idx}: {str(e)}"
                errors.append(error_msg)
                logger.warning(f"Failed to import OST feature {idx}: {str(e)}")

        return ImportResult(
            success=failed_count == 0,
            total_records=total_records,
            imported_count=imported_count,
            failed_count=failed_count,
            skipped_count=skipped_count,
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

    def _create_closure_from_ost_feature(
        self, feature: Dict[str, Any], options: ImportOptions
    ) -> ClosureCreate:
        """Create ClosureCreate from an OST prealigner feature."""
        properties = feature.get("properties") or {}

        # comment:fr / comment:it carry the same record translated. Only the
        # German is parsed: it is OST's primary language for this data, so its
        # phrasing is the least likely to be a lossy translation.
        comment = self._normalise_ost_comment(properties.get("comment:de"))
        if not comment:
            raise ValueError("Missing required field: comment:de")

        # Geometry is the feed's precomputed convenience LineString. The
        # authoritative location reference is osm_routepoints plus
        # osm_start_node_offset_m / osm_end_node_offset_m; resolving those via
        # Overpass is separate infrastructure work and is NOT done here.
        geometry_data = feature.get("geometry") or {}
        coordinates = geometry_data.get("coordinates")
        if not coordinates:
            raise ValueError("No geometry in OST feature")
        if geometry_data.get("type") != "LineString":
            raise ValueError(
                f"Unsupported OST geometry type: {geometry_data.get('type')}"
            )
        if len(coordinates) < 2:
            raise ValueError("LineString needs at least 2 coordinates")

        start_time, end_time = self._parse_ost_duration(comment)

        return ClosureCreate(
            geometry=GeoJSONGeometry(type="LineString", coordinates=coordinates),
            description=self._ost_description(comment),
            closure_type=self._map_ost_sachlage(comment),
            start_time=start_time,
            end_time=end_time,
            source=options.source,
            confidence_level=options.default_confidence,
            is_bidirectional=True,
            transport_mode=OST_DEFAULT_TRANSPORT_MODE,
            attribution=options.attribution,
            data_license=options.data_license,
        )

    def _normalise_ost_comment(self, raw: Any) -> str:
        """
        Flatten a comment string before regex matching.

        The feed HTML-escapes its text ("&lt;-&gt;") and separates clauses with
        non-breaking spaces, so unescape and collapse both before parsing.
        """
        if not raw:
            return ""
        text = html.unescape(str(raw)).replace("\xa0", " ")
        return re.sub(r"\s+", " ", text).strip()

    def _parse_ost_duration(self, comment: str) -> Tuple[datetime, datetime]:
        """
        Extract the closure window from the comment's "Dauer:" clause.

        There is no structured date field, so an unmatched or nonsensical clause
        fails the record rather than guessing a window. Both ends are required:
        the clause always spells out "<start> bis <end>".
        """
        match = _OST_DAUER_RE.search(comment)
        if not match:
            raise ValueError("Cannot parse OST duration: no 'Dauer:' clause found")

        try:
            start = self._ost_datetime(*match.group(1, 2, 3, 4, 5))
            end = self._ost_datetime(*match.group(6, 7, 8, 9, 10))
        except ValueError as e:
            raise ValueError(f"Cannot parse OST duration: {e}")

        if end <= start:
            raise ValueError("Cannot parse OST duration: end is not after start")
        return start, end

    def _ost_datetime(
        self, day: str, month: str, year: str, hour: str, minute: str
    ) -> datetime:
        """
        Build a UTC datetime from the feed's dd.mm.yyyy [HH:MM] groups.

        The feed states no timezone. Treating it as UTC matches the rest of the
        importer, but OST is Swiss (UTC+1/+2) -- confirm before relying on these
        times to the hour.
        """
        return datetime(
            int(year),
            int(month),
            int(day),
            int(hour or 0),
            int(minute or 0),
            tzinfo=timezone.utc,
        )

    def _map_ost_sachlage(self, comment: str) -> ClosureType:
        """Map the comment's free-text "Sachlage:" clause to a ClosureType."""
        match = _OST_SACHLAGE_RE.search(comment)
        if not match:
            logger.warning(
                "No 'Sachlage:' clause in OST comment, defaulting to %s",
                OST_DEFAULT_CLOSURE_TYPE.value,
            )
            return OST_DEFAULT_CLOSURE_TYPE

        sachlage = match.group(1).lower()
        for term, closure_type in OST_SACHLAGE_TYPE_MAP.items():
            if term in sachlage:
                return closure_type

        logger.warning(
            "Unknown OST Sachlage %r, defaulting to %s",
            match.group(1),
            OST_DEFAULT_CLOSURE_TYPE.value,
        )
        return OST_DEFAULT_CLOSURE_TYPE

    def _ost_description(self, comment: str) -> str:
        """
        Build a description from the comment's status, location and cause.

        Falls back to the whole comment: it is free text of unknown shape, and a
        truncated original beats a synthesised placeholder.
        """
        location = _OST_LOCATION_RE.search(comment)
        sachlage = _OST_SACHLAGE_RE.search(comment)

        parts = []
        if location:
            parts.append(f"{location.group(1).strip()}: {location.group(2).strip()}")
        if sachlage:
            parts.append(sachlage.group(1).strip())

        description = " - ".join(parts) if parts else comment
        return description[:1000]

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
