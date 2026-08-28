# 3rd Party Data Import Guide

This document describes the formats and procedures for importing road closure data from third-party sources into the OSM Road Closures system.

## Supported Formats

The system supports importing closure data from the following formats:

1. **GeoJSON** - Standard GeoJSON FeatureCollection
2. **CSV** - Comma-separated values with specific column structure
3. **Waze** - Waze Traffic API format
4. **HERE** - HERE Traffic API format
5. **TomTom** - TomTom Traffic API format
6. **OST** - OST prealigner GeoJSON feed (skeleton)

## API Endpoint

### Import Data
```
POST /api/v1/import/
```

**Parameters:**
- `file` (required): File upload containing the data
- `format` (required): Data format (geojson, csv, waze, here, tomtom, ost)
- `attribution` (required): Attribution string for the data source
- `source` (required): Name of the data source
- `data_license` (optional): License under which the data is provided
- `default_confidence` (optional): Default confidence level 1-10 (default: 5)
- `skip_validation` (optional): Skip geometry validation (default: false)

**Response:**
```json
{
  "success": true,
  "total_records": 100,
  "imported_count": 95,
  "failed_count": 5,
  "errors": ["Row 10: Invalid geometry", ...],
  "closure_ids": [1, 2, 3, ...]
}
```

### Get CSV Template
```
GET /api/v1/import/template/csv
```

Downloads a CSV template file with example data.

## Format Specifications

### 1. GeoJSON Format

GeoJSON files must be a valid `FeatureCollection` with the following structure:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-87.6298, 41.8781],
          [-87.6290, 41.8785]
        ]
      },
      "properties": {
        "description": "Road construction on Main Street",
        "start_time": "2025-01-15T08:00:00Z",
        "end_time": "2025-01-15T18:00:00Z",
        "closure_type": "construction",
        "transport_mode": "all",
        "is_bidirectional": true,
        "confidence_level": 9
      }
    }
  ]
}
```

**Geometry Types:**
- `Point` - Single location (intersection or spot closure)
- `LineString` - Road segment
- `Polygon` - Area closure
- `MultiPolygon` - Multiple area closures

**Required Properties:**
- `description` (string): Human-readable description
- `start_time` (ISO 8601 datetime): When closure begins
- `closure_type` (string): Type of closure

**Optional Properties:**
- `end_time` (ISO 8601 datetime): When closure ends
- `transport_mode` (string): Affected transport mode (all, car, hgv, bicycle, foot, motorcycle, bus, emergency)
- `is_bidirectional` (boolean): Affects both directions (default: true)
- `confidence_level` (integer 1-10): Confidence in data accuracy

**Closure Types:**
- `construction` - Road construction
- `accident` - Traffic accident
- `event` - Special event
- `maintenance` - Road maintenance
- `weather` - Weather-related closure
- `emergency` - Emergency situation
- `other` - Other closure type
- `sidewalk_repair` - Sidewalk repair
- `bike_lane_closure` - Bike lane closure
- `bridge_closure` - Bridge closure
- `tunnel_closure` - Tunnel closure

### 2. CSV Format

CSV files must have the following columns (in any order):

| Column | Required | Type | Description |
|--------|----------|------|-------------|
| description | Yes | string | Closure description |
| start_time | Yes | ISO 8601 | Start time |
| end_time | No | ISO 8601 | End time |
| closure_type | Yes | string | Type of closure |
| transport_mode | No | string | Transport mode (default: "all") |
| geometry_type | Yes | string | point, linestring, or polygon |
| coordinates | Yes | JSON array | Coordinates as JSON |
| is_bidirectional | No | boolean | Bidirectional (default: true) |
| confidence_level | No | integer 1-10 | Confidence level |

**Example CSV:**
```csv
description,start_time,end_time,closure_type,transport_mode,geometry_type,coordinates,is_bidirectional,confidence_level
"Road construction on Main St",2025-01-15T08:00:00Z,2025-01-15T18:00:00Z,construction,all,linestring,"[[-87.6298, 41.8781], [-87.6290, 41.8785]]",true,9
"Accident at intersection",2025-01-14T10:30:00Z,2025-01-14T12:00:00Z,accident,car,point,"[-87.6201, 41.8902]",false,7
```

**Coordinate Formats:**
- Point: `[-87.6201, 41.8902]`
- LineString: `[[-87.6298, 41.8781], [-87.6290, 41.8785]]`
- Polygon: `[[[-87.63, 41.88], [-87.62, 41.88], [-87.62, 41.87], [-87.63, 41.87], [-87.63, 41.88]]]`

### 3. Waze Traffic API Format

The system can import road closures from Waze Traffic API responses:

```json
{
  "alerts": [
    {
      "type": "ROAD_CLOSED",
      "location": {
        "x": -87.6298,
        "y": 41.8781
      },
      "street": "Main Street",
      "pubMillis": 1705320000000
    }
  ]
}
```

**Notes:**
- Only alerts with type `ROAD_CLOSED` or `ROAD_CLOSED_HAZARD` are imported
- Waze data is imported as Point geometries
- Transport mode defaults to `car`
- No end time is provided (ongoing closure)

### 4. HERE Traffic API Format

HERE Traffic API incident data can be imported:

```json
{
  "TRAFFIC_ITEMS": {
    "TRAFFIC_ITEM": [
      {
        "TRAFFIC_ITEM_DESCRIPTION": [
          {"value": "Road closed due to construction"}
        ],
        "LOCATION": {
          "GEOLOC": {
            "GEOMETRY": {
              "SHAPES": {
                "SHP": [
                  {"value": "41.8781,-87.6298 41.8785,-87.6290"}
                ]
              }
            }
          }
        },
        "START_TIME": "2025-01-15T08:00:00Z",
        "END_TIME": "2025-01-15T18:00:00Z"
      }
    ]
  }
}
```

**Notes:**
- Coordinates are in "lat,lon" format and converted to GeoJSON [lon,lat]
- Single points create Point geometry, multiple create LineString
- Transport mode defaults to `all`

### 5. TomTom Traffic API Format

TomTom Traffic API incidents can be imported:

```json
{
  "incidents": [
    {
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-87.6298, 41.8781],
          [-87.6290, 41.8785]
        ]
      },
      "description": "Road construction",
      "startTime": "2025-01-15T08:00:00Z",
      "endTime": "2025-01-15T18:00:00Z"
    }
  ]
}
```

**Notes:**
- Uses standard GeoJSON geometry
- Transport mode defaults to `all`

### 6. OST Data Format

The OST (Ostschweizer Fachhochschule) prealigner feed is a standard GeoJSON
`FeatureCollection`. Unlike the other supported sources it carries **no
structured closure-type or date fields** — both are embedded in translated
free text:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "comment:de": "Freigegeben: Via Cartiera 8, 6598 Tenero-Contra, Switzerland &lt;-&gt; Via Cartiera 10, 6598 Tenero-Contra, Switzerland  Sachlage: Verkehrsbehinderung Baustelle Dauer:  voraussichtlich 23.10.2023 07:00 bis 29.03.2024 17:30 Empfehlung: eine lokale Umleitung ist eingerichtet Empfohlene Umleitung: lokale Umleitung",
        "comment:fr": "Libéré: ... Situation: ... Durée: ...",
        "comment:it": "Approvato: ... Situazione: ... Durata: ...",
        "osm_routepoints": [451198454, 451198455, 451198456],
        "osm_start_node_offset_m": 25,
        "osm_end_node_offset_m": -100,
        "is_deleted": false
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[8.817322, 47.2241366], [8.8184365, 47.2240262]]
      }
    }
  ]
}
```

**Field mapping:**

| Feed field | Maps to | Notes |
|---|---|---|
| `comment:de` → `Sachlage:` clause | `closure_type` | regex, via `OST_SACHLAGE_TYPE_MAP` |
| `comment:de` → `Dauer:` clause | `start_time` / `end_time` | regex; unparseable fails the record |
| `comment:de` → status + location | `description` | HTML-unescaped |
| `geometry` | `geometry` | precomputed convenience field, see below |
| `is_deleted` | — | `true` skips the record (counted as skipped) |
| `osm_routepoints`, `osm_*_offset_m` | *(unused)* | authoritative reference, not yet resolved |
| *(no field)* | `transport_mode` | always `all`; the feed has no mode field |

**The `comment:de` grammar.** The German comment is the one parsed —
`comment:fr` / `comment:it` are the same record translated, and German is
OST's primary language for this data. Its clause structure is:

```
<Status>: <address> <-> <address>  Sachlage: <cause> Dauer: <qualifier> <start> bis <end> Empfehlung: ... Empfohlene Umleitung: ...
```

Dates are `dd.mm.yyyy` with an optional `HH:MM`. Note that the feed
HTML-escapes its text (`&lt;-&gt;`) and separates clauses with **non-breaking
spaces**; both are normalised before matching.

**Closure type vocabulary** (the `Sachlage:` clause, matched as a substring):
`baustelle`, `bauarbeiten` → construction; `unfall` → accident;
`veranstaltung` → event; `unterhalt` → maintenance; `witterung` → weather.

**Notes:**
- An unrecognised `Sachlage` falls back to `other` with a logged warning rather
  than failing the record. An unparseable or missing `Dauer:` clause **does**
  fail the record — a closure window is not something to guess.
- Feed timestamps carry no timezone and are treated as UTC.
- Failures are reported per-feature in `errors` without blocking the batch.
  Deleted records are reported in `skipped_count`, not `failed_count`.

**Known limitations** — this is a **skeleton**, validated against synthetic
data (`backend/tests/fixtures/ost_closures.json`) plus one real sample. Three
things need resolving before it is production-ready:

1. **No stable per-closure identifier exists.** No `id`-like field appears
   anywhere in the sample. Without one, deduplication and update/delete
   handling are impossible — which also makes `is_deleted` unactionable beyond
   skipping. **Open question for OST / Lukas Buchli.** No synthetic ID is
   invented here, since a wrong identity is worse than none.
2. **Geometry comes from the feed's precomputed `geometry` field.** The
   authoritative location reference is `osm_routepoints` (ordered OSM node IDs)
   plus the signed `osm_start_node_offset_m` / `osm_end_node_offset_m` metre
   offsets. Resolving those via Overpass is separate infrastructure work and is
   **not** done here; the current geometry is whatever OST's prealigner
   precomputed.
3. **Type and date extraction are regex-based best-effort against free text**,
   not structured fields, and the vocabulary table is built from a single real
   record. Both need revisiting as more samples arrive, or replacing outright
   if OST ever exposes structured fields.

## Attribution Requirements

When importing third-party data, you **must** provide:

1. **Attribution String**: Credit to the data source
   - Example: "© City of Chicago Department of Transportation"
   - Example: "Data provided by Waze Connected Citizens Program"

2. **Data License** (optional but recommended): License information
   - Example: "CC BY 4.0"
   - Example: "Open Data Commons Open Database License (ODbL)"

3. **Source Name**: Short name for the data source
   - Example: "Chicago DOT"
   - Example: "Waze CCP"

The attribution string will be displayed when users view individual closures that were imported from that source.

## Example Usage

### Import GeoJSON File

```bash
curl -X POST "http://localhost:8000/api/v1/import/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@closures.geojson" \
  -F "format=geojson" \
  -F "attribution=© City Transportation Department" \
  -F "source=City DOT" \
  -F "data_license=CC BY 4.0" \
  -F "default_confidence=8"
```

### Import CSV File

```bash
curl -X POST "http://localhost:8000/api/v1/import/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@closures.csv" \
  -F "format=csv" \
  -F "attribution=© Municipal Works Department" \
  -F "source=MWD" \
  -F "default_confidence=7"
```

### Import Waze Data

```bash
curl -X POST "http://localhost:8000/api/v1/import/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@waze_alerts.json" \
  -F "format=waze" \
  -F "attribution=Data from Waze Connected Citizens Program" \
  -F "source=Waze CCP" \
  -F "data_license=Waze CCP License"
```

## Best Practices

1. **Data Quality**
   - Always validate your data before importing
   - Use appropriate confidence levels based on data source reliability
   - Provide accurate start and end times

2. **Geometry**
   - Use LineString for road segments whenever possible
   - Use Point only for intersection or spot closures
   - Ensure coordinates are in WGS84 (EPSG:4326) format
   - Coordinates should be [longitude, latitude] order

3. **Attribution**
   - Always provide clear attribution for third-party data
   - Include license information to ensure compliance
   - Be specific about the data source

4. **Import Strategy**
   - Test with a small dataset first
   - Review import errors and fix data issues
   - Use appropriate default confidence levels
   - Schedule automated imports during off-peak hours

5. **Error Handling**
   - Review the `errors` array in import results
   - Fix data issues for failed records
   - Re-import failed records after corrections

## Automated Imports

For automated/scheduled imports from government or third-party APIs:

1. Set up authentication credentials
2. Schedule imports using cron or similar
3. Log import results for monitoring
4. Set up alerts for high failure rates
5. Implement data validation before import
6. Cache API responses to reduce load

Example cron job (daily at 2 AM):
```bash
0 2 * * * /path/to/import_script.sh >> /var/log/closure_import.log 2>&1
```

## Support

For questions or issues with data imports, please:

1. Check the API documentation at `/docs`
2. Review import error messages
3. Download and examine the CSV template
4. Contact the system administrator

## Change Log

- **2025-01-18**: Added support for Polygon/MultiPolygon geometries
- **2025-01-18**: Added transport_mode and attribution fields
- **2025-01-18**: Added support for Waze, HERE, and TomTom formats
