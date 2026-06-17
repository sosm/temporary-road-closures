# Closure-Aware Routing API

This guide documents the backend closure-aware routing endpoint,
`POST /api/v1/routing/closure-aware`, which computes a route that detours around
currently-active road closures.

## Overview

The endpoint computes a [Valhalla](https://valhalla.github.io/valhalla/) route
between two points while avoiding road closures that are **currently active** and
**relevant to the requested transportation mode**.

It exists to provide server-side closure avoidance that the frontend does not do
on its own. The frontend (`frontend/services/valhallaApi.ts`) calls Valhalla
directly and excludes *no* closures. This endpoint sits in front of Valhalla,
fetches active closures from the database, turns them into avoidance polygons,
and passes them to Valhalla as `exclude_polygons` — so the returned route routes
around them.

Authentication is **optional**: anonymous callers get routing just like
authenticated ones.

## Request format

`POST /api/v1/routing/closure-aware` with a JSON body:

| Field   | Type            | Required | Description |
| ------- | --------------- | -------- | ----------- |
| `start` | GeoJSON `Point` | yes      | Origin, `[lon, lat]` (WGS84). |
| `end`   | GeoJSON `Point` | yes      | Destination, `[lon, lat]` (WGS84). |
| `mode`  | string          | no       | `auto` \| `bicycle` \| `pedestrian`. Defaults to `auto`. Maps to the Valhalla costing model. |

> **Coordinate order:** GeoJSON is **longitude-first** (`[lon, lat]`). The
> endpoint swaps these into Valhalla's `{lat, lon}` location format internally.

## Example

Route across central Zurich by car:

```bash
curl -X POST http://localhost:8000/api/v1/routing/closure-aware \
  -H "Content-Type: application/json" \
  -d '{
    "start": {"type": "Point", "coordinates": [8.5417, 47.3769]},
    "end":   {"type": "Point", "coordinates": [8.5500, 47.3800]},
    "mode":  "auto"
  }'
```

Example response (trimmed):

```json
{
  "trip": {
    "status": 0,
    "summary": { "length": 1.2, "time": 90 },
    "legs": [ /* ... maneuvers, shape ... */ ],
    "locations": [ /* ... */ ]
  },
  "excluded_closures": 1
}
```

- `trip` is Valhalla's **inner** trip object (its `legs` / `summary` /
  `locations`), passed through untyped.
- `excluded_closures` is the number of active closures that were buffered and
  sent to Valhalla as `exclude_polygons` for this request.

## How it works

1. **Fetch closures** — active closures relevant to `mode` are queried
   (`ClosureService.get_active_closures_for_mode`).
2. **Buffer into avoidance polygons** — each closure geometry is buffered into a
   polygon (`SpatialService.buffer_closure`). Buffering is **metric-correct**:
   each geometry is reprojected from WGS84 (degrees) to the UTM zone of its own
   centroid, buffered in metres, then reprojected back — so the radii below are
   true metres anywhere.
3. **Route around them** — the buffered polygons are sent to Valhalla as
   `exclude_polygons`, and the costing model is set from `mode`.

### Buffer rules

| Geometry type          | Treatment |
| ---------------------- | --------- |
| `LineString`           | Buffered by **10 m**. |
| `Point`                | Buffered by **15 m**. |
| `Polygon` / `MultiPolygon` | Used **as-is** (already an area). |

A closure with an unsupported or invalid geometry is logged and skipped rather
than failing the whole route.

## How it differs from calling Valhalla directly

| Aspect            | This endpoint                              | Direct Valhalla call |
| ----------------- | ------------------------------------------ | -------------------- |
| Closure avoidance | Active closures injected as `exclude_polygons` | None |
| Input format      | GeoJSON `Point` (`[lon, lat]`)             | Valhalla `{lat, lon}` locations |
| Response          | `{ trip, excluded_closures }`              | Raw Valhalla response |
| Mode → costing    | Validated `auto`/`bicycle`/`pedestrian`    | Any Valhalla costing |
| Error handling    | Normalised HTTP status + user-safe message | Raw Valhalla errors |

## Error codes

| Status | Meaning |
| ------ | ------- |
| `400`  | Invalid routing request (e.g. unroutable input points). Message: *"Invalid routing request. Please check your selected points."* |
| `404`  | No route exists between the selected points. Message: *"No route found between the selected points."* |
| `500`  | Unexpected server error while building the route. |
| `502`  | Valhalla returned a 5xx upstream error. Message: *"Routing service is temporarily unavailable."* |
| `503`  | Valhalla is unreachable (connection/transport error). Message: *"Routing service is temporarily unavailable."* |
| `504`  | The routing request to Valhalla timed out. Message: *"Routing request timed out. Please try again."* |

## Limitations

- **Switzerland only.** The Valhalla instance is built with Swiss tiles; routes
  outside Switzerland will fail (typically `400`/`404`).
- **No real-time traffic.** Routing considers only active closures, not live
  traffic, congestion, or travel-time conditions.
- **Active, mode-relevant closures only.** Closures that are not currently
  active, or that do not affect the requested `mode`, are not avoided.
- **`start` and `end` must be GeoJSON Points.** Other geometry types are
  rejected by request validation.
