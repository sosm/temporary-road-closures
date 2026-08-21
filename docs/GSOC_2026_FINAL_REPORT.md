# GSoC 2026 Final Report: Make closures.osm.ch Production Ready

This is a summary of the work completed during Google Summer of Code 2026, working on [closures.osm.ch](https://closures.osm.ch) for the OpenStreetMap Foundation. It highlights the main features delivered, outlines remaining work, and links each PR for easy reference.

## Completed Work

- **Self-hosted Valhalla** - Replaced the public Valhalla instance with a self-hosted one, removing the 49-point `exclude_locations` geometry cap.
- **Closure-aware routing endpoint** - Added a backend `POST /api/v1/routing/closure-aware` endpoint using Shapely geometry buffering and `exclude_polygons`, moving closure-avoidance logic out of the frontend and into the backend.
- **Frontend cleanup** - Removed the duplicated `closureTypeEffects` lookup table and other closure-routing logic from the frontend, now that the backend owns it.
- **Spec-compliant OpenLR encoding** - Replaced the non-standard OpenLR implementation with spec-compliant encoding via Valhalla map-matching, fixing interoperability with standard OpenLR tooling.
- **Vector tile endpoint** - Added a server-side MVT vector tile endpoint (`ST_AsMVT`) for active closures, consumed as a live map layer.
- **OAuth2 login fix** - Fixed a production bug causing silent login failures for OSM/Google accounts with long avatar URLs.
- **Production hotfix** - Diagnosed and fixed a production outage in the closures list endpoint.

## Remaining Work / Future Suggestions

- **Government data ingestion** - CIFS/DATEX II importers and a new OST push-receiver endpoint for Swiss ASTRA data. Work has started but is not yet complete.
- **UI internationalisation** - Frontend is currently English-only; deferred for future work.

## All my PRs

- [PR #26](https://github.com/sosm/temporary-road-closures/pull/26) - Widen `avatar_url` to TEXT to resolve OAuth2 login failure
- [PR #38](https://github.com/sosm/temporary-road-closures/pull/38) - Replace `OAuth2PasswordRequestForm` with `UserLogin` for Pydantic v2
- [PR #44](https://github.com/sosm/temporary-road-closures/pull/44) - Fix container hostnames in `.env.example` for Docker Compose
- [PR #46](https://github.com/sosm/temporary-road-closures/pull/46) - Add Valhalla routing engine to docker-compose
- [PR #68](https://github.com/sosm/temporary-road-closures/pull/68) - Add Valhalla to docker-compose.prod.yml
- [PR #72](https://github.com/sosm/temporary-road-closures/pull/72) - Closure-aware routing endpoint (Task 3)
- [PR #75](https://github.com/sosm/temporary-road-closures/pull/75) - Upgrade pydantic-settings to 2.14.2
- [PR #76](https://github.com/sosm/temporary-road-closures/pull/76) - Wire closure-aware routing page to backend endpoint
- [PR #102](https://github.com/sosm/temporary-road-closures/pull/102) - Return closure objects from closure-aware routing endpoint
- [PR #118](https://github.com/sosm/temporary-road-closures/pull/118) - Server-side MVT vector tiles for main map
- [PR #120](https://github.com/sosm/temporary-road-closures/pull/120) - Fix production outage: `query_closures` returning None
- [PR #121](https://github.com/sosm/temporary-road-closures/pull/121) - Spec-compliant OpenLR encoding via Valhalla map-matching
- [PR #127](https://github.com/sosm/temporary-road-closures/pull/127) - Fix OpenLR encoding silently skipped for all imported closures

## Acknowledgements

Huge thanks to my mentors, [Simon Poole](https://github.com/simonpoole) and [David Haberthür](https://github.com/habi), for their guidance and support throughout the project.