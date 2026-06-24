"use client"
import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Toaster } from '@/components/ui/sonner';
import { Navigation, Route, MapPin, Info, Car, Bike, User, Target, Check, TriangleAlert } from 'lucide-react';
import RoutingForm from '@/components/Demo/RoutingForm';
import ClosuresList from '@/components/Demo/ClosuresList';
import { Closure } from '@/services/api';
import { useLocationStatus } from '@/context/LocationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/utils/utils';
import { Separator } from '@/components/ui/separator';
import LocationIndicator from '@/components/Layout/LocationIndicator';
import DemoControlPanel from '@/components/Demo/DemoControlPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileResponsiveStack } from '@/components/Layout/MobileResponsiveStack';
import { doesClosureAffectMode, TransportationMode } from '@/utils/routing-utils';

// Dynamically import map to avoid SSR issues
const RoutingMapComponent = dynamic(
    () => import('@/components/Demo/RoutingMapComponent'),
    {
        ssr: false,
        loading: () => (
            <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading routing map...</p>
                </div>
            </div>
        )
    }
);

interface RoutePoint {
    lat: number;
    lng: number;
    address?: string;
}

interface CalculatedRoute {
    coordinates: [number, number][];
    distance: number;
    duration: number;
    avoidedClosures: number;
    excludedPoints: [number, number][];
}

const ClosureAwareRoutingPage: React.FC = () => {
    const [sourcePoint, setSourcePoint] = useState<RoutePoint | null>(null);
    const [destinationPoint, setDestinationPoint] = useState<RoutePoint | null>(null);
    const [transportationMode, setTransportationMode] = useState<TransportationMode>('auto');
    const [route, setRoute] = useState<CalculatedRoute | null>(null);
    const [directRoute, setDirectRoute] = useState<CalculatedRoute | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [closuresInPath, setClosuresInPath] = useState<Closure[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isSelectingSource, setIsSelectingSource] = useState(false);
    const [isSelectingDestination, setIsSelectingDestination] = useState(false);
    const isMobile = useIsMobile();

    const { status: locationStatus } = useLocationStatus();

    // Calculate bounding box with 1-mile buffer
    const calculateBoundingBox = useCallback((source: RoutePoint, destination: RoutePoint) => {
        const minLat = Math.min(source.lat, destination.lat);
        const maxLat = Math.max(source.lat, destination.lat);
        const minLng = Math.min(source.lng, destination.lng);
        const maxLng = Math.max(source.lng, destination.lng);

        // Add 1-mile buffer (approximately 0.0145 degrees)
        const buffer = 0.0145;

        return {
            north: maxLat + buffer,
            south: minLat - buffer,
            east: maxLng + buffer,
            west: minLng - buffer
        };
    }, []);

    // Fetch closures within bounding box
    const fetchClosuresInPath = useCallback(async (bbox: any) => {
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/closures/?` +
                `bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
                {
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                return data.items || [];
            } else {
                console.warn('Failed to fetch closures, using empty array');
                return [];
            }
        } catch (error) {
            console.warn('Error fetching closures:', error);
            return [];
        }
    }, []);

    // Calculate a route via Valhalla directly, optionally excluding closure points.
    const calculateValhallaRoute = useCallback(async (
        source: RoutePoint,
        destination: RoutePoint,
        mode: TransportationMode,
        excludeLocations: [number, number][] = []
    ): Promise<CalculatedRoute> => {
        const valhallaRequest = {
            locations: [
                { lat: source.lat, lon: source.lng, type: 'break' as const },
                { lat: destination.lat, lon: destination.lng, type: 'break' as const }
            ],
            costing: mode,
            directions_options: {
                units: 'kilometers' as const,
                format: 'json' as const
            },
            // Valhalla caps exclude_locations at 50; keep within limit.
            ...(excludeLocations.length > 0 && {
                exclude_locations: excludeLocations.map(([lat, lng]) => ({ lat, lon: lng })).slice(0, 49)
            }),
        };

        try {
            const response = await fetch(
                process.env.NEXT_PUBLIC_VALHALLA_URL || 'https://valhalla1.openstreetmap.de/route',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(valhallaRequest)
                }
            );

            if (!response.ok) {
                throw new Error(`Valhalla API error: ${response.status}`);
            }

            const data = await response.json();

            // Decode polyline to get coordinates
            const shape = data.trip.legs[0]?.shape;
            if (!shape) {
                throw new Error('No route shape returned');
            }

            const coordinates = decodePolyline(shape, 6);

            return {
                coordinates,
                distance: data.trip.summary.length,
                duration: data.trip.summary.time / 60, // Convert to minutes
                avoidedClosures: excludeLocations.length,
                excludedPoints: excludeLocations
            };
        } catch (error) {
            console.error('Valhalla routing error:', error);
            throw new Error('Failed to calculate route');
        }
    }, []);

    // Baseline route for the comparison card — always direct Valhalla, no exclusions.
    const calculateDirectRoute = useCallback((
        source: RoutePoint,
        destination: RoutePoint,
        mode: TransportationMode
    ): Promise<CalculatedRoute> => {
        return calculateValhallaRoute(source, destination, mode, []);
    }, [calculateValhallaRoute]);

    // Closure-aware route via backend; server-side exclusion via exclude_polygons
    const calculateClosureAwareRoute = useCallback(async (
        source: RoutePoint,
        destination: RoutePoint,
        mode: TransportationMode
    ): Promise<CalculatedRoute> => {
        const requestBody = {
            start: { type: 'Point' as const, coordinates: [source.lng, source.lat] },
            end: { type: 'Point' as const, coordinates: [destination.lng, destination.lat] },
            mode,
        };

        let response: Response;
        try {
            response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/routing/closure-aware`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }
            );
        } catch (error) {
            console.error('Closure-aware routing error:', error);
            throw new Error('Routing service is temporarily unavailable.');
        }

        if (!response.ok) {
            if (response.status === 504) {
                throw new Error('Routing request timed out. Please try again.');
            }
            if (response.status >= 500) {
                throw new Error('Routing service is temporarily unavailable.');
            }
            // Tag status so the caller can fall back on 400/404 (e.g. outside Switzerland).
            const e = new Error('Failed to calculate route. Please try again.');
            (e as any).status = response.status;
            throw e;
        }

        const data = await response.json();

        const shape = data.trip?.legs?.[0]?.shape;
        if (!shape) {
            throw new Error('No route shape returned');
        }

        const coordinates = decodePolyline(shape, 6);

        return {
            coordinates,
            distance: data.trip.summary.length,
            duration: data.trip.summary.time / 60, // Convert to minutes
            avoidedClosures: data.excluded_closures ?? 0,
            excludedPoints: []
        };
    }, []);

    // Handle route calculation
    const handleCalculateRoute = useCallback(async () => {
        if (!sourcePoint || !destinationPoint) {
            setError('Please select both source and destination points');
            return;
        }

        setIsCalculating(true);
        setError(null);

        try {
            // 1. Fetch closures for visualization; server-side routing handles exclusion.
            const bbox = calculateBoundingBox(sourcePoint, destinationPoint);
            console.log('🗺️ Calculated bounding box:', bbox);

            const allClosures = await fetchClosuresInPath(bbox);
            console.log('🚧 Found total closures in path:', allClosures.length);
            setClosuresInPath(allClosures);

            // 2. Build mode-filtered exclude_locations for the outside-Switzerland fallback.
            const excludeLocations: [number, number][] = [];
            allClosures.forEach((closure: Closure) => {
                if (closure.status !== 'active' || !doesClosureAffectMode(closure, transportationMode) || !closure.geometry) return;
                if (closure.geometry.type === 'Point') {
                    const [lng, lat] = closure.geometry.coordinates as number[];
                    excludeLocations.push([lat, lng]);
                } else if (closure.geometry.type === 'LineString') {
                    (closure.geometry.coordinates as number[][]).forEach(([lng, lat]) => excludeLocations.push([lat, lng]));
                }
            });

            // 3. Run direct and closure-aware routes in parallel; fall back to Valhalla on 400/404
            const [directRouteResult, closureAwareRoute] = await Promise.all([
                calculateDirectRoute(sourcePoint, destinationPoint, transportationMode),
                (async () => {
                    try {
                        return await calculateClosureAwareRoute(sourcePoint, destinationPoint, transportationMode);
                    } catch (err: any) {
                        if (err?.status === 400 || err?.status === 404) {
                            return calculateValhallaRoute(sourcePoint, destinationPoint, transportationMode, excludeLocations);
                        }
                        throw err;
                    }
                })(),
            ]);

            setDirectRoute(directRouteResult);
            setRoute(closureAwareRoute);

            console.log(`✅ ${transportationMode} routes calculated successfully`);
        } catch (error) {
            console.error('❌ Route calculation failed:', error);
            setError(error instanceof Error ? error.message : 'Failed to calculate route');
        } finally {
            setIsCalculating(false);
        }
    }, [sourcePoint, destinationPoint, transportationMode, calculateBoundingBox, fetchClosuresInPath, calculateDirectRoute, calculateClosureAwareRoute, calculateValhallaRoute]);

    // Clear route
    const handleClearRoute = useCallback(() => {
        setRoute(null);
        setDirectRoute(null);
        setClosuresInPath([]);
        setError(null);
    }, []);

    // Handle transportation mode change
    const handleTransportationModeChange = useCallback((mode: TransportationMode) => {
        setTransportationMode(mode);
        // Clear existing routes when mode changes
        handleClearRoute();
    }, [handleClearRoute]);

    // Handle Selection Toggle from RoutingForm
    const handleSelectionToggle = useCallback((type: 'source' | 'destination') => {
        if (type === 'source') {
            setIsSelectingSource(prev => !prev);
            setIsSelectingDestination(false);
        } else {
            setIsSelectingDestination(prev => !prev);
            setIsSelectingSource(false);
        }
    }, []);

    // Point Selection Instructions Component (Matching Closures Page design)
    const PointSelectionInstructions: React.FC<{
        isSelectingSource: boolean;
        isSelectingDestination: boolean;
        sourcePoint: RoutePoint | null;
        destinationPoint: RoutePoint | null;
        onClear: () => void;
        onFinish: () => void;
    }> = ({ isSelectingSource, isSelectingDestination, sourcePoint, destinationPoint, onClear, onFinish }) => {
        if (!isSelectingSource && !isSelectingDestination) return null;

        const getInstructionText = () => {
            if (isSelectingSource) {
                return sourcePoint ? "Starting point selected" : "Click on the map to select starting location";
            } else {
                return destinationPoint ? "Destination selected" : "Click on the map to select destination";
            }
        };

        const isDone = (isSelectingSource && sourcePoint) || (isSelectingDestination && destinationPoint);

        return (
            <Card className="fixed md:bottom-6 bottom-28 left-1/2 transform -translate-x-1/2 z-[1001] w-full max-w-[calc(100vw-2rem)] md:max-w-md border-2 border-primary/50 bg-background/95 backdrop-blur-sm shadow-2xl animate-in slide-in-from-bottom-5">
                <CardContent className="p-4">
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full animate-pulse bg-primary"></div>
                                {isSelectingSource ? <MapPin className="text-green-600" size={18} /> : <Target className="text-red-600" size={18} />}
                                <span className="font-bold text-sm tracking-tight capitalize">
                                    {isSelectingSource ? 'Start' : 'Destination'} Selection
                                </span>
                            </div>
                            <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-widest">
                                {isSelectingSource ? 'Source' : 'Target'}
                            </Badge>
                        </div>

                        <div className="text-sm text-foreground/80 font-semibold italic">
                            {getInstructionText()}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border">
                            <div className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.15em]">
                                {isDone ? (
                                    <span className="flex items-center gap-1 text-green-600"><Check size={10} /> Location set</span>
                                ) : (
                                    "Awaiting map click..."
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={onClear}
                                    className="h-8 text-[10px] font-black uppercase tracking-widest hover:bg-destructive/10 hover:text-destructive rounded-full px-4"
                                >
                                    Clear
                                </Button>
                                <Button 
                                    size="sm" 
                                    onClick={onFinish}
                                    className="h-8 text-[10px] font-black uppercase tracking-widest rounded-full px-6 bg-slate-900 hover:bg-slate-800"
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    // Routing Status Component (Matching Closures Page design)
    const RoutingStatus: React.FC<{
        isCalculating: boolean;
        hasRoute: boolean;
        error?: string | null;
        routeInfo?: CalculatedRoute | null;
    }> = ({ isCalculating, hasRoute, error, routeInfo }) => {
        if (!isCalculating && !hasRoute && !error) return null;

        return (
            <div className="fixed top-20 right-4 z-[1050] flex flex-col items-end gap-2 max-w-sm">
                {isCalculating && (
                    <Alert className="bg-primary text-primary-foreground border-none shadow-2xl py-2 px-4 flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <AlertDescription className="text-xs font-black uppercase tracking-widest text-inherit">
                            Generating Optimal Path...
                        </AlertDescription>
                    </Alert>
                )}

                {error && (
                    <Alert variant="destructive" className="shadow-2xl py-2 px-4 border-none flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                        <TriangleAlert className="w-4 h-4" />
                        <AlertDescription className="text-xs font-bold">
                            {error}
                        </AlertDescription>
                    </Alert>
                )}

                {hasRoute && routeInfo && (
                    <Alert className="bg-green-600 text-white border-none shadow-2xl py-3 px-5 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <Route className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 leading-none mb-1">Route Optimized</div>
                            <AlertDescription className="text-sm font-black leading-none text-white">
                                {routeInfo.distance.toFixed(2)}km ({Math.round(routeInfo.duration)} min)
                            </AlertDescription>
                        </div>
                    </Alert>
                )}
            </div>
        );
    };

    // Get the appropriate icon for the current transportation mode
    const getTransportationIcon = (mode: TransportationMode) => {
        switch (mode) {
            case 'auto':
                return Car;
            case 'bicycle':
                return Bike;
            case 'pedestrian':
                return User;
            default:
                return Navigation;
        }
    };

    const TransportationIcon = getTransportationIcon(transportationMode);

    const renderRoutingHeader = () => (
        <div className="px-4 py-4 flex items-center justify-between shrink-0 border-b border-gray-100 bg-white">
            <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Routing Engine</h2>
                <div className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mt-2">
                    {transportationMode === 'auto' && 'Avoiding road closures'}
                    {transportationMode === 'bicycle' && 'Avoiding bicycle closures'}
                    {transportationMode === 'pedestrian' && 'Avoiding pedestrian closures'}
                </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-full px-4 py-1.5 flex items-center gap-2.5 shadow-lg transition-all active:scale-95 cursor-default">
                <TransportationIcon className="w-3 h-3 text-white animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">
                    {transportationMode} <span className="text-blue-400">Nav</span>
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
            </div>
        </div>
    );

    const renderSidebarContent = () => (
        <>
            {!isMobile && renderRoutingHeader()}
            {/* Routing Form */}
            <div className={cn("flex-1 min-h-0 pb-6", !isMobile && "overflow-y-auto overscroll-contain")}>
                <RoutingForm
                    sourcePoint={sourcePoint}
                    destinationPoint={destinationPoint}
                    transportationMode={transportationMode}
                    onSourceChange={setSourcePoint}
                    onDestinationChange={setDestinationPoint}
                    onTransportationModeChange={handleTransportationModeChange}
                    onCalculateRoute={handleCalculateRoute}
                    onClearRoute={handleClearRoute}
                    isCalculating={isCalculating}
                    route={route}
                    directRoute={directRoute}
                    error={error}
                    isSelectingSource={isSelectingSource}
                    isSelectingDestination={isSelectingDestination}
                    onSelectionToggle={handleSelectionToggle}
                    hideHeader={true}
                />

                {/* Closures List */}
                {closuresInPath.length > 0 && (
                    <ClosuresList
                        closures={closuresInPath}
                        transportationMode={transportationMode}
                    />
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
                <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex items-center space-x-2">
                        <Info className="w-3 h-3" />
                        <span>Powered by Valhalla routing engine</span>
                    </div>
                    <div>Uses OpenStreetMap data and transportation-aware closure filtering</div>
                    <div className="font-semibold text-gray-600">Coverage: Switzerland only</div>
                    <div className="font-bold text-gray-600">
                        {closuresInPath.filter(c => doesClosureAffectMode(c, transportationMode)).length} of {closuresInPath.length} closures affect {transportationMode}
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <div className="h-[calc(100vh-80px)] md:h-screen flex flex-col bg-gray-50 overflow-hidden">
            <header className="hidden md:flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 w-full shrink-0">
                <div className="flex items-center gap-4">
                </div>

                <div className="flex items-center gap-6">
                    {/* Route Statistics */}
                    {route && (
                        <div className="hidden md:flex items-center gap-3">
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Est. Distance</span>
                                <span className="text-sm font-black text-slate-900">{route.distance.toFixed(2)} km</span>
                            </div>
                            <Separator orientation="vertical" className="h-6" />
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Est. Duration</span>
                                <span className="text-sm font-black text-slate-900">{Math.round(route.duration)} min</span>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        {/* Demo Control Panel */}
                        <div className="hidden md:block">
                            <DemoControlPanel />
                        </div>

                        <Separator orientation="vertical" className="h-4 mx-2" />

                        {/* Location Status */}
                        <LocationIndicator />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Desktop Sidebar */}
                {!isMobile && (
                    <div className={`
                        w-96 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shrink-0
                        ${!isSidebarOpen ? 'w-0 border-r-0' : ''}
                    `}>
                        {isSidebarOpen && renderSidebarContent()}
                    </div>
                )}

                {/* Mobile Responsive Stack */}
                {isMobile && (
                    <MobileResponsiveStack
                        isOpen={true}
                        header={renderRoutingHeader()}
                        peekHeight="h-[120px]"
                        midHeight="h-[50vh]"
                        fullHeight="h-[85vh]"
                        footer={
                            <div className="p-4 border-t border-gray-200 bg-gray-50">
                                <div className="text-[10px] text-gray-500 flex items-center space-x-2">
                                    <Info className="w-3 h-3" />
                                    <span>Powered by Valhalla routing engine</span>
                                </div>
                                <div className="text-[10px] font-semibold text-gray-600 mt-1">Coverage: Switzerland only</div>
                            </div>
                        }
                    >
                        {renderSidebarContent()}
                    </MobileResponsiveStack>
                )}

                {/* Map */}
                <div className="flex-1 relative">
                    <RoutingMapComponent
                        sourcePoint={sourcePoint}
                        destinationPoint={destinationPoint}
                        transportationMode={transportationMode}
                        route={route}
                        directRoute={directRoute}
                        closures={closuresInPath}
                        onSourceSelect={(p) => {
                            setSourcePoint(p);
                            if (isSelectingSource) setIsSelectingSource(false);
                        }}
                        onDestinationSelect={(p) => {
                            setDestinationPoint(p);
                            if (isSelectingDestination) setIsSelectingDestination(false);
                        }}
                    />



                    {/* Point Selection Instructions */}
                    <PointSelectionInstructions
                        isSelectingSource={isSelectingSource}
                        isSelectingDestination={isSelectingDestination}
                        sourcePoint={sourcePoint}
                        destinationPoint={destinationPoint}
                        onClear={() => {
                            if (isSelectingSource) setSourcePoint(null);
                            if (isSelectingDestination) setDestinationPoint(null);
                        }}
                        onFinish={() => {
                            setIsSelectingSource(false);
                            setIsSelectingDestination(false);
                        }}
                    />

                    {/* Routing Status Indicators */}
                    <RoutingStatus
                        isCalculating={isCalculating}
                        hasRoute={!!route}
                        error={error}
                        routeInfo={route}
                    />



                    {/* Selection Hints */}
                    {(isSelectingSource || isSelectingDestination) && (
                        <div className="fixed top-32 left-1/2 transform -translate-x-1/2 z-[1050]">
                            <div className="bg-white/80 backdrop-blur-sm border border-border rounded-full shadow-xl px-4 py-1.5 flex items-center gap-2 animate-bounce">
                                <Info className="w-3 h-3 text-primary" />
                                <span className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
                                    Click map to set {isSelectingSource ? 'start' : 'destination'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Notifications */}
            <Toaster position="top-center" />
        </div>
    );
};

// Polyline decoder (precision 6 for Valhalla)
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

export default function ClosureAwareRoutingPageWrapper() {
    return <ClosureAwareRoutingPage />;
}