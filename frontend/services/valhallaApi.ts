// services/valhallaApi.ts
import axios from 'axios';

const VALHALLA_API_URL = process.env.NEXT_PUBLIC_VALHALLA_URL || 'https://valhalla1.openstreetmap.de/route';

export interface ValhallaLocation {
    lat: number;
    lon: number;
    type?: 'break';
    heading?: number;
    name?: string;
    street_side?: 'left' | 'right';
    date_time?: string;
    search_cutoff?: number;
    node_snap_tolerance?: number;
    way_id?: number;
    original_index?: number;
}

export interface ValhallaRequest {
    locations: ValhallaLocation[];
    costing: 'auto' | 'bicycle' | 'pedestrian' | 'motorcycle' | 'bus' | 'taxi';
    costing_options?: {
        auto?: {
            maneuver_penalty?: number;
            gate_cost?: number;
            gate_penalty?: number;
            toll_booth_cost?: number;
            toll_booth_penalty?: number;
            country_crossing_cost?: number;
            country_crossing_penalty?: number;
            ignore_access?: boolean;
            ignore_restrictions?: boolean;
        };
        bicycle?: {
            ignore_access?: boolean;
            ignore_restrictions?: boolean;
        };
        pedestrian?: {
            ignore_access?: boolean;
            ignore_restrictions?: boolean;
        };
    };
    directions_options?: {
        units?: 'kilometers' | 'miles';
        language?: string;
        format?: 'json';
        narrative?: boolean;
    };
    shape_match?: 'edge_walk' | 'map_snap' | 'walk_or_snap';
    encoded_polyline?: boolean;
    filters?: {
        attributes?: string[];
        action?: 'include' | 'exclude';
    };
}

export interface ValhallaManeuver {
    type: number;
    instruction: string;
    verbal_transition_alert_instruction?: string;
    verbal_pre_transition_instruction?: string;
    verbal_post_transition_instruction?: string;
    street_names?: string[];
    time: number;
    length: number;
    begin_shape_index: number;
    end_shape_index: number;
    toll?: boolean;
    rough?: boolean;
    gate?: boolean;
    ferry?: boolean;
    sign?: {
        exit_number?: string;
        exit_branch?: string;
        exit_toward?: string;
        exit_name?: string;
    };
    roundabout_exit_count?: number;
    depart_instruction?: string;
    verbal_depart_instruction?: string;
    arrive_instruction?: string;
    verbal_arrive_instruction?: string;
    transit_info?: any;
    verbal_multi_cue?: boolean;
    travel_mode?: string;
    travel_type?: string;
}

export interface ValhallaLeg {
    maneuvers: ValhallaManeuver[];
    summary: {
        has_time_restrictions: boolean;
        has_toll: boolean;
        has_highway: boolean;
        has_ferry: boolean;
        min_lat: number;
        min_lon: number;
        max_lat: number;
        max_lon: number;
        time: number;
        length: number;
        cost: number;
    };
    shape: string; // Encoded polyline
}

export interface ValhallaTrip {
    locations: ValhallaLocation[];
    legs: ValhallaLeg[];
    summary: {
        has_time_restrictions: boolean;
        has_toll: boolean;
        has_highway: boolean;
        has_ferry: boolean;
        min_lat: number;
        min_lon: number;
        max_lat: number;
        max_lon: number;
        time: number;
        length: number;
        cost: number;
    };
    status_message: string;
    status: number;
    units: string;
    shape?: string;
    confidence_score?: number;
}

export interface ValhallaResponse {
    trip: ValhallaTrip;
}

// Polyline decoder function (precision 6 for Valhalla)
function decodePolyline(str: string, precision: number = 6): [number, number][] {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates: [number, number][] = [];
    const factor = Math.pow(10, precision || 5);

    while (index < str.length) {
        let b, shift = 0, result = 0;
        do {
            b = str.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const deltaLat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        lat += deltaLat;

        shift = 0;
        result = 0;
        do {
            b = str.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const deltaLng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        lng += deltaLng;

        coordinates.push([lat / factor, lng / factor]);
    }

    return coordinates;
}

export class ValhallaAPI {
    private apiUrl: string;
    private timeout: number;

    constructor(apiUrl?: string, timeout: number = 10000) {
        this.apiUrl = apiUrl || VALHALLA_API_URL;
        this.timeout = timeout;
    }

    async getRoute(request: ValhallaRequest): Promise<ValhallaResponse> {
        try {
            console.log('🗺️ Calling Valhalla API:', this.apiUrl);
            console.log('📍 Request:', JSON.stringify(request, null, 2));

            const response = await axios.post(this.apiUrl, request, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: this.timeout
            });

            console.log('✅ Valhalla response received');
            return response.data;
        } catch (error) {
            console.error('❌ Valhalla API error:', error);
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    throw new Error('Routing request timed out. Please try again.');
                }
                if (error.response?.status === 400) {
                    throw new Error('Invalid routing request. Please check your selected points.');
                }
                if (error.response?.status === 404) {
                    throw new Error('No route found between the selected points.');
                }
                if (error.response?.status && error.response?.status >= 500) {
                    throw new Error('Routing service is temporarily unavailable.');
                }
            }
            throw new Error('Failed to calculate route. Please try again.');
        }
    }

    async getRouteCoordinates(
        locations: ValhallaLocation[],
        costing: 'auto' | 'bicycle' | 'pedestrian' = 'auto',
        ignoreAccess: boolean = false
    ): Promise<[number, number][]> {
        if (locations.length < 2) {
            throw new Error('At least 2 locations are required for routing');
        }

        const request: ValhallaRequest = {
            locations: locations.map(loc => ({
                lat: loc.lat,
                lon: loc.lon,
                type: 'break'
            })),
            costing,
            ...(ignoreAccess && {
                costing_options: { [costing]: { ignore_access: true } }
            }),
            directions_options: {
                units: 'kilometers',
                format: 'json'
            },
            encoded_polyline: true
        };

        const response = await this.getRoute(request);

        // Decode all polylines and combine coordinates
        const allCoordinates: [number, number][] = [];

        for (const leg of response.trip.legs) {
            const coordinates = decodePolyline(leg.shape, 6);
            allCoordinates.push(...coordinates);
        }

        // Remove duplicate consecutive points
        const dedupedCoordinates: [number, number][] = [];
        for (let i = 0; i < allCoordinates.length; i++) {
            if (i === 0 ||
                allCoordinates[i][0] !== allCoordinates[i - 1][0] ||
                allCoordinates[i][1] !== allCoordinates[i - 1][1]) {
                dedupedCoordinates.push(allCoordinates[i]);
            }
        }

        console.log(`🛣️ Route calculated: ${dedupedCoordinates.length} points, ${response.trip.summary.length.toFixed(2)} km`);
        return dedupedCoordinates;
    }

    // Convert route coordinates to GeoJSON LineString format for closure creation
    routeToGeoJSON(coordinates: [number, number][]): number[][] {
        // Convert from [lat, lng] to [lng, lat] for GeoJSON
        return coordinates.map(([lat, lng]) => [lng, lat]);
    }

    // Helper method to create a simple route between two points
    async getSimpleRoute(
        startLat: number,
        startLng: number,
        endLat: number,
        endLng: number,
        costing: 'auto' | 'bicycle' | 'pedestrian' = 'auto'
    ): Promise<[number, number][]> {
        const locations: ValhallaLocation[] = [
            { lat: startLat, lon: startLng, type: 'break' },
            { lat: endLat, lon: endLng, type: 'break' }
        ];

        return this.getRouteCoordinates(locations, costing);
    }

    // Helper method to check if Valhalla API is available
    async isAvailable(): Promise<boolean> {
        try {
            // Make a simple health check request
            await axios.get(this.apiUrl.replace('/route', '/status'), {
                timeout: 5000
            });
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.warn('⚠️ Valhalla API not available:', errorMessage);
            return false;
        }
    }

    // Get route statistics
    getRouteStats(response: ValhallaResponse): {
        distance_km: number;
        time_minutes: number;
        has_toll: boolean;
        has_highway: boolean;
        has_ferry: boolean;
        maneuvers_count: number;
    } {
        const summary = response.trip.summary;
        return {
            distance_km: summary.length,
            time_minutes: Math.round(summary.time / 60 * 10) / 10,
            has_toll: summary.has_toll,
            has_highway: summary.has_highway,
            has_ferry: summary.has_ferry,
            maneuvers_count: response.trip.legs.reduce((total, leg) => total + leg.maneuvers.length, 0)
        };
    }
}

// Export singleton instance
export const valhallaAPI = new ValhallaAPI();

// Export helper functions
export { decodePolyline };

// Types for frontend components
export interface RoutePoint {
    lat: number;
    lng: number;
    index?: number;
}

export interface RoutingState {
    isRouting: boolean;
    hasRoute: boolean;
    routeCoordinates: [number, number][];
    routeDistance?: number;
    routeTime?: number;
    error?: string;
}