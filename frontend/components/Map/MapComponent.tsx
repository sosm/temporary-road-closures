// components/Map/MapComponent.tsx
"use client"
import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useClosures } from '@/context/ClosuresContext';
import { Closure, BoundingBox, getDirectionArrowFromCoords } from '@/services/api';
import { valhallaAPI } from '@/services/valhallaApi';
import { toast } from 'sonner';

// Import the hook (you'll need to create this file in your hooks directory)
import { useChicagoMapCenter } from '@/hooks/useMapCenter';
import { useLocationStatus } from '@/context/LocationContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapComponentProps {
    onMapClick?: (latlng: L.LatLng) => void;
    selectedPoints?: L.LatLng[];
    isSelecting?: boolean;
    onClearPoints?: () => void;
    onFinishSelection?: () => void;
    onRouteCalculated?: (coordinates: [number, number][], stats: any) => void;
    geometryType?: 'Point' | 'LineString'; // New prop to handle geometry type
}

// Helper function to safely extract coordinates
function extractCoordinates(closure: Closure): { points: [number, number][], isValid: boolean } {
    try {
        if (!closure.geometry || !closure.geometry.coordinates) {
            console.warn('Invalid geometry for closure:', closure.id);
            return { points: [], isValid: false };
        }

        if (closure.geometry.type === 'Point') {
            // Handle Point geometry - could be [lng, lat] or [[lng, lat]]
            let lng: number, lat: number;

            if (Array.isArray(closure.geometry.coordinates[0])) {
                // Format: [[lng, lat]]
                [lng, lat] = closure.geometry.coordinates[0] as number[];
            } else {
                // Format: [lng, lat]
                [lng, lat] = closure.geometry.coordinates as unknown as number[];
            }

            if (typeof lng !== 'number' || typeof lat !== 'number') {
                console.warn('Invalid Point coordinates for closure:', closure.id, closure.geometry.coordinates);
                return { points: [], isValid: false };
            }

            return { points: [[lat, lng]], isValid: true };

        } else if (closure.geometry.type === 'LineString') {
            // Handle LineString geometry - should be [[lng, lat], [lng, lat], ...]
            const coordinates = closure.geometry.coordinates;

            if (!Array.isArray(coordinates) || coordinates.length === 0) {
                console.warn('Invalid LineString coordinates for closure:', closure.id);
                return { points: [], isValid: false };
            }

            const points: [number, number][] = [];

            for (const coord of coordinates) {
                if (!Array.isArray(coord) || coord.length < 2) {
                    console.warn('Invalid coordinate pair in LineString:', coord);
                    continue;
                }

                const [lng, lat] = coord;
                if (typeof lng !== 'number' || typeof lat !== 'number') {
                    console.warn('Invalid coordinate values:', lng, lat);
                    continue;
                }

                points.push([lat, lng]);
            }

            return { points, isValid: points.length > 0 };
        }

        console.warn('Unsupported geometry type:', closure.geometry.type);
        return { points: [], isValid: false };

    } catch (error) {
        console.error('Error extracting coordinates for closure:', closure.id, error);
        return { points: [], isValid: false };
    }
}

// Helper function to create direction arrow markers
function createDirectionArrows(points: [number, number][], isBidirectional: boolean, color: string): L.Layer[] {
    const arrows: L.Layer[] = [];

    if (points.length < 2) return arrows;

    // Create arrows along the line segments
    for (let i = 0; i < points.length - 1; i++) {
        const [lat1, lng1] = points[i];
        const [lat2, lng2] = points[i + 1];

        const arrowSymbol = getDirectionArrowFromCoords(lat1, lng1, lat2, lng2);

        // Calculate midpoint of segment for arrow placement
        const midLat = (lat1 + lat2) / 2;
        const midLng = (lng1 + lng2) / 2;

        // Create forward direction arrow
        const forwardArrow = L.divIcon({
            className: 'direction-arrow',
            html: `
                <div class="arrow-container">
                    <div class="arrow-symbol" style="color: ${color}; font-size: 18px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">
                        ${arrowSymbol}
                    </div>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
        });

        const forwardMarker = L.marker([midLat, midLng], { icon: forwardArrow })
            .bindTooltip(`Direction: ${arrowSymbol}`, {
                permanent: false,
                direction: 'top',
                offset: [0, -10]
            });

        arrows.push(forwardMarker);

        // Create backward direction arrow for bidirectional closures
        if (isBidirectional) {
            // Get reverse arrow
            const reverseArrowSymbol = getDirectionArrowFromCoords(lat2, lng2, lat1, lng1);

            const reverseArrow = L.divIcon({
                className: 'direction-arrow bidirectional',
                html: `
                    <div class="arrow-container">
                        <div class="arrow-symbol" style="color: ${color}; font-size: 18px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">
                            ${reverseArrowSymbol}
                        </div>
                    </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            });

            // Offset the reverse arrow slightly to avoid overlap
            const offsetDistance = 0.0002;
            const offsetLat = midLat + (lat2 - lat1) * offsetDistance;
            const offsetLng = midLng + (lng2 - lng1) * offsetDistance;

            const reverseMarker = L.marker([offsetLat, offsetLng], { icon: reverseArrow })
                .bindTooltip(`Reverse Direction: ${reverseArrowSymbol}`, {
                    permanent: false,
                    direction: 'top',
                    offset: [0, -10]
                });

            arrows.push(reverseMarker);
        }
    }

    return arrows;
}

// Component to handle map view updates based on dynamic center
const MapViewController: React.FC<{
    mapCenter: {
        center: [number, number];
        zoom: number;
        loading: boolean;
        usingGeolocation: boolean;
    };
}> = ({ mapCenter }) => {
    const map = useMap();
    const hasSetInitialView = useRef(false);

    useEffect(() => {
        if (!mapCenter.loading && !hasSetInitialView.current) {
            console.log(`🗺️ Setting map view to: ${mapCenter.center[0].toFixed(6)}, ${mapCenter.center[1].toFixed(6)} (zoom: ${mapCenter.zoom})`);
            map.setView(mapCenter.center, mapCenter.zoom);
            hasSetInitialView.current = true;
        }
    }, [map, mapCenter.loading, mapCenter.center, mapCenter.zoom]);

    return null;
};

// Component to handle map events and render closures
const MapEventHandler: React.FC<{
    onMapClick?: (latlng: L.LatLng) => void;
    isSelecting?: boolean;
    selectedPoints?: L.LatLng[];
    onRouteCalculated?: (coordinates: [number, number][], stats: any) => void;
    geometryType?: 'Point' | 'LineString';
    mapCenter: {
        center: [number, number];
        zoom: number;
        loading: boolean;
        usingGeolocation: boolean;
    };
}> = ({ onMapClick, isSelecting, selectedPoints = [], onRouteCalculated, geometryType = 'LineString', mapCenter }) => {
    const map = useMap();
    const { state, fetchClosures, selectClosure } = useClosures();
    const { closures, selectedClosure } = state;
    const closureLayersRef = useRef<L.LayerGroup>(new L.LayerGroup());
    const selectionLayersRef = useRef<L.LayerGroup>(new L.LayerGroup());
    const routeLayersRef = useRef<L.LayerGroup>(new L.LayerGroup());

    const [routingState, setRoutingState] = useState<{
        isRouting: boolean;
        hasRoute: boolean;
        routeCoordinates: [number, number][];
        error?: string;
    }>({
        isRouting: false,
        hasRoute: false,
        routeCoordinates: []
    });

    // Helper function to calculate route distance
    function calculateRouteDistance(coordinates: [number, number][]): number {
        let distance = 0;
        for (let i = 0; i < coordinates.length - 1; i++) {
            const [lat1, lng1] = coordinates[i];
            const [lat2, lng2] = coordinates[i + 1];
            distance += calculateHaversineDistance(lat1, lng1, lat2, lng2);
        }
        return distance;
    }

    // Helper function to calculate direct distance between two points
    function calculateDirectDistance(point1: L.LatLng, point2: L.LatLng): number {
        return calculateHaversineDistance(point1.lat, point1.lng, point2.lat, point2.lng);
    }

    // Haversine distance formula
    function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Handle automatic routing when 2+ points are selected for LineString
    useEffect(() => {
        const calculateRoute = async () => {
            if (geometryType === 'LineString' && selectedPoints.length >= 2 && !routingState.isRouting) {
                setRoutingState(prev => ({ ...prev, isRouting: true, error: undefined }));

                try {
                    const routePoints = selectedPoints.map(point => ({
                        lat: point.lat,
                        lng: point.lng
                    }));

                    console.log('🗺️ Calculating route for LineString:', routePoints);

                    const routeCoordinates = await valhallaAPI.getRouteCoordinates(
                        routePoints.map(p => ({ lat: p.lat, lon: p.lng, type: 'break' as const })),
                        'auto',
                        true // ignore access restrictions: we're annotating a closure, not navigating
                    );

                    const routeStats = {
                        distance_km: calculateRouteDistance(routeCoordinates),
                        points_count: routeCoordinates.length,
                        direct_distance: calculateDirectDistance(selectedPoints[0], selectedPoints[selectedPoints.length - 1])
                    };

                    setRoutingState({
                        isRouting: false,
                        hasRoute: true,
                        routeCoordinates,
                        error: undefined
                    });

                    if (onRouteCalculated) {
                        onRouteCalculated(routeCoordinates, routeStats);
                    }

                } catch (error) {
                    console.error('❌ Routing failed:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Failed to calculate route';

                    setRoutingState({
                        isRouting: false,
                        hasRoute: false,
                        routeCoordinates: [],
                        error: errorMessage
                    });

                    toast.error(`Routing failed: ${errorMessage}`);
                }
            } else if (geometryType === 'Point' || selectedPoints.length < 2) {
                // Clear route when not applicable
                setRoutingState({
                    isRouting: false,
                    hasRoute: false,
                    routeCoordinates: [],
                    error: undefined
                });
            }
        };

        const debounceTimer = setTimeout(calculateRoute, 500);
        return () => clearTimeout(debounceTimer);
    }, [selectedPoints, onRouteCalculated, geometryType]);

    // Handle map click events with geometry type awareness
    useMapEvents({
        click: (e) => {
            if (onMapClick && isSelecting) {
                // For Point geometry, only allow one point
                if (geometryType === 'Point' && selectedPoints.length >= 1) {
                    toast('Point closure can only have one location. Clear existing point first.', {
                        style: { background: '#fbbf24', color: '#92400e' }
                    });
                    return;
                }

                onMapClick(e.latlng);
            }
        },
        moveend: () => {
            // Only fetch closures on moveend if we're not still loading the initial center
            if (!mapCenter.loading) {
                // Fetch closures when map bounds change
                const bounds = map.getBounds();
                const bbox: BoundingBox = {
                    north: bounds.getNorth(),
                    south: bounds.getSouth(),
                    east: bounds.getEast(),
                    west: bounds.getWest(),
                };
                fetchClosures(bbox);
            }
        },
    });

    // Update route visualization (only for LineString)
    useEffect(() => {
        const routeLayerGroup = routeLayersRef.current;
        routeLayerGroup.clearLayers();

        if (geometryType === 'LineString' && routingState.hasRoute && routingState.routeCoordinates.length > 1) {
            const latlngs = routingState.routeCoordinates.map(([lat, lng]) => [lat, lng] as [number, number]);

            const routePolyline = L.polyline(latlngs, {
                color: '#2563eb',
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 5',
            }).bindTooltip(`Routed path: ${routingState.routeCoordinates.length} points`, {
                permanent: false,
                direction: 'top'
            });

            routeLayerGroup.addLayer(routePolyline);

            const routeArrows = createDirectionArrows(latlngs, false, '#2563eb');
            routeArrows.forEach(arrow => routeLayerGroup.addLayer(arrow));

            if (latlngs.length > 1) {
                const routeBounds = L.latLngBounds(latlngs);
                map.fitBounds(routeBounds, { padding: [20, 20] });
            }
        }

        routeLayerGroup.addTo(map);

        return () => {
            routeLayerGroup.clearLayers();
        };
    }, [routingState, map, geometryType]);

    // Update selection visualization
    useEffect(() => {
        const layerGroup = selectionLayersRef.current;
        layerGroup.clearLayers();

        if (selectedPoints.length > 0) {
            selectedPoints.forEach((point, index) => {
                const isStart = index === 0;
                const isEnd = index === selectedPoints.length - 1;
                const isOnlyPoint = selectedPoints.length === 1;

                let iconHtml = '';
                let className = 'selection-marker';

                if (geometryType === 'Point') {
                    iconHtml = '<div class="marker-content point">📍</div>';
                    className += ' point-marker';
                } else {
                    if (isStart) {
                        iconHtml = '<div class="marker-content start">🚩</div>';
                        className += ' start-point';
                    } else if (isEnd && selectedPoints.length > 1) {
                        iconHtml = '<div class="marker-content end">🏁</div>';
                        className += ' end-point';
                    } else {
                        iconHtml = `<div class="marker-content waypoint">${index}</div>`;
                        className += ' waypoint';
                    }
                }

                const customIcon = L.divIcon({
                    className: className,
                    html: iconHtml,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                });

                const tooltipText = geometryType === 'Point' ? 'Point Location' :
                    isStart ? 'Start Point' :
                        isEnd ? 'End Point' :
                            `Waypoint ${index}`;

                const marker = L.marker([point.lat, point.lng], { icon: customIcon })
                    .bindTooltip(tooltipText, { permanent: false });

                layerGroup.addLayer(marker);
            });

            // Add direct connection line for LineString (before routing)
            if (geometryType === 'LineString' && selectedPoints.length > 1 && !routingState.hasRoute && !routingState.isRouting) {
                const latlngs = selectedPoints.map(point => [point.lat, point.lng] as [number, number]);
                const directLine = L.polyline(latlngs, {
                    color: '#dc2626',
                    weight: 3,
                    opacity: 0.6,
                    dashArray: '5, 5',
                });

                layerGroup.addLayer(directLine);
            }
        }

        layerGroup.addTo(map);

        return () => {
            layerGroup.clearLayers();
        };
    }, [selectedPoints, routingState.hasRoute, routingState.isRouting, map, geometryType]);

    // Update closures on map
    useEffect(() => {
        const layerGroup = closureLayersRef.current;
        layerGroup.clearLayers();

        closures.forEach((closure) => {
            const { points, isValid } = extractCoordinates(closure);

            if (!isValid || points.length === 0) {
                console.warn('Skipping closure with invalid coordinates:', closure.id);
                return;
            }

            let layer: L.Layer | null = null;
            const closureColor = getClosureColor(closure);

            if (closure.geometry.type === 'Point') {
                const [lat, lng] = points[0];

                const icon = L.divIcon({
                    className: 'custom-closure-icon',
                    html: `
                        <div class="closure-marker ${closure.status === 'active' ? 'active' : 'inactive'}">
                            <div class="closure-marker-inner">⚠</div>
                        </div>
                    `,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                });

                layer = L.marker([lat, lng], { icon })
                    .bindPopup(createClosurePopup(closure));

            } else if (closure.geometry.type === 'LineString') {
                layer = L.polyline(points, {
                    color: closureColor,
                    weight: 6,
                    opacity: 0.8,
                }).bindPopup(createClosurePopup(closure));

                const isBidirectional = closure.is_bidirectional || false;
                const arrows = createDirectionArrows(points, isBidirectional, closureColor);
                arrows.forEach(arrow => layerGroup.addLayer(arrow));
            }

            if (layer) {
                layer.on('click', () => {
                    selectClosure(closure);
                });

                // Highlight selected closure
                if (selectedClosure?.id === closure.id) {
                    if (layer instanceof L.Marker) {
                        layer.setZIndexOffset(1000);
                    } else if (layer instanceof L.Polyline) {
                        layer.setStyle({
                            color: '#3b82f6',
                            weight: 8,
                            opacity: 1,
                        });
                    }
                }

                layerGroup.addLayer(layer);
            }
        });

        layerGroup.addTo(map);

        return () => {
            layerGroup.clearLayers();
        };
    }, [closures, selectedClosure, map, selectClosure]);

    // Focus on selected closure
    useEffect(() => {
        if (selectedClosure) {
            const { points, isValid } = extractCoordinates(selectedClosure);

            if (!isValid || points.length === 0) {
                console.warn('Cannot focus on closure with invalid coordinates:', selectedClosure.id);
                return;
            }

            if (selectedClosure.geometry.type === 'Point') {
                const [lat, lng] = points[0];
                map.setView([lat, lng], 16);
            } else if (selectedClosure.geometry.type === 'LineString') {
                const bounds = L.latLngBounds(points);
                map.fitBounds(bounds, { padding: [20, 20] });
            }
        }
    }, [selectedClosure, map]);

    return (
        <>
            {/* Routing Status Indicators - Only for LineString */}
            {geometryType === 'LineString' && (
                <>
                    {routingState.isRouting && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
                            <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span className="text-sm font-medium">Calculating route...</span>
                            </div>
                        </div>
                    )}

                    {routingState.error && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg max-w-md">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm">Error: {routingState.error}</span>
                            </div>
                        </div>
                    )}

                    {routingState.hasRoute && selectedPoints.length >= 2 && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm">Route calculated ({routingState.routeCoordinates.length} points)</span>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Point Selection Status */}
            {geometryType === 'Point' && selectedPoints.length === 1 && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 bg-orange-600 text-white px-4 py-2 rounded-lg shadow-lg">
                    <div className="flex items-center space-x-2">
                        <span className="text-sm">Point location selected</span>
                    </div>
                </div>
            )}
        </>
    );
};

// Helper functions
function getClosureColor(closure: Closure): string {
    switch (closure.status) {
        case 'active':
            return '#ef4444'; // red
        case 'inactive':
            return '#6b7280'; // gray
        case 'expired':
            return '#9ca3af'; // light gray
        case 'planned':
            return '#f59e0b'; // orange
        default:
            return '#6b7280';
    }
}

function createClosurePopup(closure: Closure): string {
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const getDurationText = (hours: number) => {
        if (hours < 1) return `${Math.round(hours * 60)} minutes`;
        if (hours < 24) return `${Math.round(hours)} hours`;
        return `${Math.round(hours / 24)} days`;
    };

    const getDirectionText = (closure: Closure) => {
        if (closure.geometry.type === 'Point') return '<div><strong>Type:</strong> Point Closure</div>';
        if (closure.is_bidirectional) return '<div><strong>Direction:</strong> Bidirectional ↔</div>';
        return '<div><strong>Direction:</strong> Unidirectional →</div>';
    };

    return `
        <div class="closure-popup">
            <h3 class="font-semibold text-gray-900 mb-2">${closure.description}</h3>
            <div class="space-y-1 text-sm">
                <div><strong>Type:</strong> ${closure.closure_type.replace('_', ' ')}</div>
                <div><strong>Status:</strong> <span class="capitalize ${closure.status === 'active' ? 'text-red-600' :
            closure.status === 'expired' ? 'text-gray-600' : 'text-blue-600'
        }">${closure.status}</span></div>
                <div><strong>Source:</strong> ${closure.source}</div>
                <div><strong>Duration:</strong> ${getDurationText(closure.duration_hours)}</div>
                <div><strong>Confidence:</strong> ${closure.confidence_level}/10</div>
                ${getDirectionText(closure)}
                <div class="text-xs text-gray-500 mt-2">
                    <div><strong>Start:</strong> ${formatDate(closure.start_time)}</div>
                    <div><strong>End:</strong> ${formatDate(closure.end_time)}</div>
                </div>
                ${closure.openlr_code ? `
                    <div class="text-xs text-blue-600 mt-2">
                        <strong>OpenLR:</strong> ${closure.openlr_code}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

const MapComponent: React.FC<MapComponentProps> = ({
    onMapClick,
    selectedPoints = [],
    isSelecting = false,
    onClearPoints,
    onFinishSelection,
    onRouteCalculated,
    geometryType = 'LineString'
}) => {
    const { fetchClosures } = useClosures();

    // Use the dynamic map center hook with Chicago fallback
    const mapCenter = useChicagoMapCenter(true);
    const { setStatus } = useLocationStatus();

    // Publish location status to context for the Header
    React.useEffect(() => {
        setStatus({
            usingGeolocation: mapCenter.usingGeolocation,
            error: mapCenter.error,
            loading: mapCenter.loading,
        });
    }, [mapCenter.usingGeolocation, mapCenter.error, mapCenter.loading, setStatus]);

    // Initial map load - wait for center to be determined
    useEffect(() => {
        if (!mapCenter.loading) {
            // Use a larger initial bounding box that makes sense for the determined center
            let initialBounds: BoundingBox;

            if (mapCenter.usingGeolocation) {
                // If using geolocation, create a reasonable area around user's location
                const [lat, lng] = mapCenter.center;
                const buffer = 0.05; // Roughly 5-6 km buffer
                initialBounds = {
                    north: lat + buffer,
                    south: lat - buffer,
                    east: lng + buffer,
                    west: lng - buffer,
                };
                console.log('🌍 Using geolocation-based initial bounds:', initialBounds);
            } else {
                // Use Chicago bounds as fallback (or adjust based on your fallback center)
                initialBounds = {
                    north: 42.0,
                    south: 41.6,
                    east: -87.3,
                    west: -87.9,
                };
                console.log('🏙️ Using default Chicago bounds:', initialBounds);
            }

            fetchClosures(initialBounds);
        }
    }, [fetchClosures, mapCenter.loading, mapCenter.usingGeolocation, mapCenter.center]);

    const getMaxPoints = () => geometryType === 'Point' ? 1 : Infinity;
    const getSelectionText = () => {
        if (geometryType === 'Point') {
            return selectedPoints.length === 0 ? 'Click to select point' : 'Point selected';
        }
        return selectedPoints.length === 0 ? 'Click to add points' :
            selectedPoints.length === 1 ? '1 point - add more for routing' :
                `${selectedPoints.length} points selected`;
    };

    return (
        <>
            <style jsx global>{`
                .closure-marker {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    font-weight: bold;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    border: 2px solid white;
                }
                
                .closure-marker.active {
                    background-color: #ef4444;
                    color: white;
                }
                
                .closure-marker.inactive {
                    background-color: #9ca3af;
                    color: white;
                }
                
                .closure-marker-inner {
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
                
                .closure-popup {
                    min-width: 250px;
                    max-width: 300px;
                }
                
                .leaflet-popup-content-wrapper {
                    border-radius: 8px;
                }

                .leaflet-container {
                    cursor: ${isSelecting ? 'crosshair' : 'grab'};
                }

                .leaflet-container.leaflet-dragging {
                    cursor: ${isSelecting ? 'crosshair' : 'grabbing'};
                }

                .direction-arrow {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                }

                .arrow-container {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transform-origin: center;
                }

                .arrow-symbol {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 50%;
                    width: 22px;
                    height: 22px;
                    border: 1px solid rgba(0, 0, 0, 0.3);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }

                .bidirectional .arrow-symbol {
                    background: rgba(255, 215, 0, 0.95);
                    border-color: rgba(218, 165, 32, 0.6);
                }

                .direction-arrow:hover .arrow-symbol {
                    transform: scale(1.1);
                    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
                }

                /* Selection marker styles */
                .selection-marker {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                }

                .marker-content {
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    font-size: 16px;
                    font-weight: bold;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    border: 2px solid white;
                }

                .marker-content.start {
                    background-color: #22c55e;
                    color: white;
                }

                .marker-content.end {
                    background-color: #dc2626;
                    color: white;
                }

                .marker-content.waypoint {
                    background-color: #3b82f6;
                    color: white;
                    font-size: 12px;
                }

                .marker-content.point {
                    background-color: #ea580c;
                    color: white;
                    font-size: 14px;
                }
            `}</style>

            {/* Loading indicator while getting location */}
            {mapCenter.loading && (
                <div className="absolute inset-0 z-20 bg-white bg-opacity-90 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600 font-medium">Getting your location...</p>
                        <p className="text-sm text-gray-500 mt-1">This helps us center the map near you</p>
                    </div>
                </div>
            )}

            <MapContainer
                center={mapCenter.center}
                zoom={mapCenter.zoom}
                className="h-full w-full"
                zoomControl={true}
                worldCopyJump={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapViewController mapCenter={mapCenter} />

                <MapEventHandler
                    onMapClick={onMapClick}
                    isSelecting={isSelecting}
                    selectedPoints={selectedPoints}
                    onRouteCalculated={onRouteCalculated}
                    geometryType={geometryType}
                    mapCenter={mapCenter}
                />
            </MapContainer>


            {/* Selection Controls */}
            {isSelecting && (
                <div className="absolute md:bottom-4 bottom-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-primary/20 p-4 min-w-[320px] animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                <span className="text-xs font-black uppercase tracking-wider text-gray-900">{getSelectionText()}</span>
                            </div>
                            <Badge variant="outline" className="font-mono text-[10px] border-primary/20 bg-primary/5">
                                {selectedPoints.length} PTS
                            </Badge>
                        </div>
                        
                        <div className="text-[11px] font-medium text-gray-500 leading-tight">
                            {geometryType === 'Point' 
                                ? 'Click once on the map to pinpoint the exact closure location.' 
                                : 'Select multiple points along the road to define the closed segment.'}
                        </div>

                        <div className="flex gap-2 pt-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onClearPoints}
                                disabled={selectedPoints.length === 0}
                                className="flex-1 h-8 text-[11px] font-bold rounded-lg border-gray-200"
                            >
                                Reset
                            </Button>
                            <Button
                                size="sm"
                                onClick={onFinishSelection}
                                className="flex-1 h-8 text-[11px] font-bold rounded-lg bg-primary hover:bg-primary/90 shadow-sm"
                            >
                                Done
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MapComponent;
