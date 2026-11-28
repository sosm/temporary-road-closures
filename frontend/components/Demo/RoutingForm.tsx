import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { 
    MapPin, Navigation, Route, Zap, AlertTriangle, 
    RotateCcw, ArrowRight, Clock, TrendingUp, Car, 
    Bike, User, CheckCircle2, Info, AlertCircle, 
    SeparatorHorizontal, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/utils/utils';
import { TransportationMode } from '@/utils/routing-utils';

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

interface RoutingFormProps {
    sourcePoint: RoutePoint | null;
    destinationPoint: RoutePoint | null;
    transportationMode: TransportationMode;
    onSourceChange: (point: RoutePoint | null) => void;
    onDestinationChange: (point: RoutePoint | null) => void;
    onTransportationModeChange: (mode: TransportationMode) => void;
    onCalculateRoute: () => void;
    onClearRoute: () => void;
    isCalculating: boolean;
    route: CalculatedRoute | null;
    directRoute: CalculatedRoute | null;
    error: string | null;
    isSelectingSource: boolean;
    isSelectingDestination: boolean;
    onSelectionToggle: (type: 'source' | 'destination') => void;
    hideHeader?: boolean;
}

interface FormData {
    source: string;
    destination: string;
}

const transportationModes = [
    {
        key: 'auto' as TransportationMode,
        label: 'Car',
        icon: Car,
        color: 'blue' as const,
        description: 'Driving routes using roads and highways'
    },
    {
        key: 'bicycle' as TransportationMode,
        label: 'Bicycle',
        icon: Bike,
        color: 'green' as const,
        description: 'Cycling routes using bike lanes and roads'
    },
    {
        key: 'pedestrian' as TransportationMode,
        label: 'Walking',
        icon: User,
        color: 'orange' as const,
        description: 'Walking routes using sidewalks and paths'
    }
];

const RoutingForm: React.FC<RoutingFormProps> = ({
    sourcePoint,
    destinationPoint,
    transportationMode,
    onSourceChange,
    onDestinationChange,
    onTransportationModeChange,
    onCalculateRoute,
    onClearRoute,
    isCalculating,
    route,
    directRoute,
    error,
    isSelectingSource,
    isSelectingDestination,
    onSelectionToggle,
    hideHeader = false
}) => {

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch
    } = useForm<FormData>();

    // Geocoding function
    const geocodeAddress = async (address: string): Promise<RoutePoint | null> => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
            );
            const data = await response.json();

            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    address: data[0].display_name
                };
            }
            return null;
        } catch (error) {
            console.error('Geocoding error:', error);
            return null;
        }
    };

    const handleFormSubmit = async (data: FormData) => {
        if (data.source && !sourcePoint) {
            const sourceResult = parseCoordinates(data.source) ?? await geocodeAddress(data.source);
            if (sourceResult) {
                onSourceChange(sourceResult);
            }
        }

        if (data.destination && !destinationPoint) {
            const destResult = parseCoordinates(data.destination) ?? await geocodeAddress(data.destination);
            if (destResult) {
                onDestinationChange(destResult);
            }
        }

        // If both points are set, calculate route
        if ((sourcePoint || data.source) && (destinationPoint || data.destination)) {
            onCalculateRoute();
        }
    };

    const handleMapSelection = (type: 'source' | 'destination') => {
        onSelectionToggle(type);
    };

    const handleClear = () => {
        onClearRoute();
        onSourceChange(null);
        onDestinationChange(null);
        setValue('source', '');
        setValue('destination', '');
        if (isSelectingSource || isSelectingDestination) {
            onSelectionToggle(isSelectingSource ? 'source' : 'destination');
        }
    };

    const formatCoordinate = (lat: number, lng: number) => {
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    };

    const routeComparison = route && directRoute ? {
        distanceIncrease: ((route.distance - directRoute.distance) / directRoute.distance) * 100,
        timeIncrease: ((route.duration - directRoute.duration) / directRoute.duration) * 100,
        distanceDiff: route.distance - directRoute.distance,
        timeDiff: route.duration - directRoute.duration
    } : null;

    const selectedMode = transportationModes.find(mode => mode.key === transportationMode);
    const DynamicIcon = selectedMode?.icon || Navigation;

    const parseCoordinates = (input: string): RoutePoint | null => {
        const match = input.trim().match(
            /^(-?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(-?(?:\d+(?:\.\d+)?|\.\d+))$/
        );
        if (!match) return null;

        const lat = Number(match[1]);
        const lng = Number(match[2]);
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

        return { lat, lng };
    };

    return (
        <div className="p-4 space-y-6">
            {/* Header */}
            {!hideHeader && (
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Routing Engine</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                        {transportationMode === 'auto' && 'Avoiding road closures'}
                        {transportationMode === 'bicycle' && 'Avoiding bicycle closures'}
                        {transportationMode === 'pedestrian' && 'Avoiding pedestrian closures'}
                    </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <Route className="w-5 h-5 text-blue-600" />
                </div>
            </div>
        )}

            <div className="space-y-4">
                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Travel Mode</Label>
                <div className="relative flex w-full bg-muted/40 p-1 rounded-full border border-border/50 overflow-hidden">
                    {/* Sliding Highlight */}
                    <div 
                        className={cn(
                            "absolute top-1 bottom-1 w-[calc((100%-8px)/3)] rounded-full transition-all duration-300 ease-in-out z-0 left-1",
                            transportationMode === 'auto' && "translate-x-0 bg-blue-600",
                            transportationMode === 'bicycle' && "translate-x-full bg-green-600",
                            transportationMode === 'pedestrian' && "translate-x-[200%] bg-orange-600"
                        )}
                    />
                    
                    {transportationModes.map((mode) => {
                        const Icon = mode.icon;
                        const isSelected = transportationMode === mode.key;
                        
                        return (
                            <Button
                                key={mode.key}
                                type="button"
                                onClick={() => onTransportationModeChange(mode.key)}
                                className={cn(
                                    "flex-1 h-9 gap-1.5 font-bold uppercase tracking-tighter text-[10px] transition-all duration-300 rounded-full relative z-10 bg-transparent hover:!bg-white/10 shadow-none border-none px-2",
                                    isSelected 
                                        ? "text-white" 
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{mode.label}</span>
                            </Button>
                        );
                    })}
                </div>
                <Alert className="bg-gray-50 border-gray-100 py-3">
                    <AlertDescription className="text-xs text-gray-500 leading-relaxed">
                        {selectedMode?.description}
                    </AlertDescription>
                </Alert>
            </div>

            {/* Route Input Form */}
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                {/* Source */}
                <div className="space-y-3">
                    <Label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                            <MapPin className="w-3 h-3 text-green-600" />
                        </div>
                        <span>Origin</span>
                    </Label>

                    {sourcePoint ? (
                        <div className="relative p-4 bg-green-50/50 border border-green-100 rounded-xl overflow-hidden group">
                            <div className="flex items-center justify-between relative z-10">
                                <div className="min-w-0 pr-4">
                                    <div className="text-sm font-bold text-green-900 truncate">
                                        {sourcePoint.address || 'Selected Point'}
                                    </div>
                                    <div className="text-[11px] text-green-600 font-mono mt-0.5">
                                        {formatCoordinate(sourcePoint.lat, sourcePoint.lng)}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onSourceChange(null)}
                                    className="text-green-600 hover:text-green-700 hover:bg-green-100/50 h-8 shrink-0 text-xs font-bold"
                                >
                                    Change
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="relative">
                                <Input
                                    {...register('source', { required: 'Start location is required' })}
                                    placeholder="Enter address or coordinates"
                                    className={cn(
                                        "h-10 bg-white shadow-sm border-gray-200 focus:ring-green-500 rounded-full px-5 text-sm",
                                        isSelectingSource && "border-green-500 bg-green-50 ring-2 ring-green-100"
                                    )}
                                />
                            </div>
                            <div className="flex justify-between items-center">
                                <Button
                                    type="button"
                                    variant={isSelectingSource ? "default" : "secondary"}
                                    size="sm"
                                    onClick={() => handleMapSelection('source')}
                                    className={cn(
                                        "h-9 px-4 gap-2 rounded-full",
                                        isSelectingSource && "bg-green-600 hover:bg-green-700 text-white"
                                    )}
                                >
                                    <Navigation className={cn("w-3.5 h-3.5", isSelectingSource && "animate-pulse")} />
                                    {isSelectingSource ? 'Select on Map...' : 'Choose on Map'}
                                </Button>
                                {errors.source && (
                                    <span className="text-xs font-medium text-red-500 animate-in fade-in slide-in-from-right-2">
                                        {errors.source.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Destination */}
                <div className="space-y-3">
                    <Label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                        <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                            <MapPin className="w-3 h-3 text-red-600" />
                        </div>
                        <span>Destination</span>
                    </Label>

                    {destinationPoint ? (
                        <div className="relative p-4 bg-red-50/50 border border-red-100 rounded-xl overflow-hidden group">
                            <div className="flex items-center justify-between relative z-10">
                                <div className="min-w-0 pr-4">
                                    <div className="text-sm font-bold text-red-900 truncate">
                                        {destinationPoint.address || 'Selected Point'}
                                    </div>
                                    <div className="text-[11px] text-red-600 font-mono mt-0.5">
                                        {formatCoordinate(destinationPoint.lat, destinationPoint.lng)}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDestinationChange(null)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-100/50 h-8 shrink-0 text-xs font-bold"
                                >
                                    Change
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="relative">
                                <Input
                                    {...register('destination', { required: 'Destination is required' })}
                                    placeholder="Enter address or coordinates"
                                    className={cn(
                                        "h-10 bg-white shadow-sm border-gray-200 focus:ring-red-500 rounded-full px-5 text-sm",
                                        isSelectingDestination && "border-red-500 bg-red-50 ring-2 ring-red-100"
                                    )}
                                />
                            </div>
                            <div className="flex justify-between items-center">
                                <Button
                                    type="button"
                                    variant={isSelectingDestination ? "default" : "secondary"}
                                    size="sm"
                                    onClick={() => handleMapSelection('destination')}
                                    className={cn(
                                        "h-9 px-4 gap-2 rounded-full",
                                        isSelectingDestination && "bg-red-600 hover:bg-red-700 text-white"
                                    )}
                                >
                                    <Navigation className={cn("w-3.5 h-3.5", isSelectingDestination && "animate-pulse")} />
                                    {isSelectingDestination ? 'Select on Map...' : 'Choose on Map'}
                                </Button>
                                {errors.destination && (
                                    <span className="text-xs font-medium text-red-500 animate-in fade-in slide-in-from-right-2">
                                        {errors.destination.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-full mt-4">
                    <Button
                        type="submit"
                        disabled={isCalculating || (!sourcePoint && !watch('source')) || (!destinationPoint && !watch('destination'))}
                        className="flex-1 h-10 text-sm font-bold gap-2 shadow-sm bg-blue-600 hover:bg-blue-700 rounded-full transition-all duration-200"
                    >
                        {isCalculating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Generating...</span>
                            </>
                        ) : (
                            <>
                                <Route className="w-4 h-4" />
                                <span>Calculate Route</span>
                            </>
                        )}
                    </Button>

                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClear}
                        className="h-10 w-10 p-0 rounded-full text-gray-500 hover:text-gray-900 hover:bg-white transition-all duration-200 shrink-0"
                        title="Reset form"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </Button>
                </div>
            </form>

            {/* Selection Instructions */}
            {(isSelectingSource || isSelectingDestination) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start space-x-2">
                        <MapPin className="w-4 h-4 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-700">
                            <p className="font-medium mb-1">
                                {isSelectingSource ? 'Select Start Location' : 'Select Destination'}
                            </p>
                            <p>Click anywhere on the map to set your {isSelectingSource ? 'start location' : 'destination'}.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Transportation Mode Info */}
            {route && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                        {selectedMode && <selectedMode.icon className="w-4 h-4 text-gray-600" />}
                        <span className="text-sm font-medium text-gray-900">
                            Route optimized for {selectedMode?.label.toLowerCase()}
                        </span>
                    </div>
                    <p className="text-xs text-gray-600">
                        Only closures affecting {selectedMode?.label.toLowerCase()} traffic are considered for route avoidance.
                    </p>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertTitle>Routing Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Route Results */}
            {route && (
                <div className="space-y-4">
                    <Separator className="my-6" />
                    
                    <Card className="border-none bg-slate-900 text-white overflow-hidden shadow-2xl relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                             <Zap className="w-24 h-24" />
                        </div>
                        <CardHeader className="pb-3 flex-row items-center space-y-0 gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                                <Route className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-black tracking-tight text-white uppercase">
                                    Optimized Route
                                </CardTitle>
                                <CardDescription className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">
                                    Valhalla Pathing Ready
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 relative z-10">
                            <div className="space-y-1 p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Distance</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xl font-black text-white">{route.distance.toFixed(2)} km</span>
                                </div>
                            </div>
                            <div className="space-y-1 p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Travel Time</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xl font-black text-white">{Math.round(route.duration)} min</span>
                                </div>
                            </div>
                            <div className="col-span-2 pt-3 flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                                </div>
                                <span className="text-[11px] font-black text-blue-100 uppercase tracking-wide">
                                    Navigated around {route.avoidedClosures} closure{route.avoidedClosures !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Direct Route Comparison */}
                    {directRoute && routeComparison && (
                        <Card className="border-gray-100 bg-gray-50/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-700 uppercase tracking-tight">
                                    <ArrowRight className="w-4 h-4" />
                                    Baseline Route Comparison
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 border-b border-gray-100 pb-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Distance</p>
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-3.5 h-3.5 text-gray-400" />
                                            <span className="text-sm font-bold text-gray-700">{directRoute.distance.toFixed(2)} km</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Time</p>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                                            <span className="text-sm font-bold text-gray-700">{Math.round(directRoute.duration)} min</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Comparison Stats */}
                                {(Math.abs(routeComparison.distanceIncrease) > 0.1 || Math.abs(routeComparison.timeIncrease) > 0.1) && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-blue-600">
                                            <TrendingUp className="w-4 h-4" />
                                            <span className="text-[11px] font-bold uppercase tracking-wider">Route Impact</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-100">
                                                <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Extra Distance</p>
                                                <p className="text-sm font-black text-orange-900 leading-none">
                                                    +{routeComparison.distanceDiff.toFixed(2)} km
                                                </p>
                                                <p className="text-[10px] font-medium text-orange-600 mt-1">
                                                    +{routeComparison.distanceIncrease.toFixed(1)}% longer
                                                </p>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-red-50 border border-red-100">
                                                <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Extra Time</p>
                                                <p className="text-sm font-black text-red-900 leading-none">
                                                    +{Math.round(routeComparison.timeDiff)} min
                                                </p>
                                                <p className="text-[10px] font-medium text-red-600 mt-1">
                                                    +{routeComparison.timeIncrease.toFixed(1)}% slower
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Instructions */}
            {!route && !isCalculating && (
                <Alert className="bg-blue-50/50 border-blue-100">
                    <Navigation className="w-4 h-4" />
                    <AlertTitle className="text-blue-900 font-bold">How it works</AlertTitle>
                    <AlertDescription>
                        <ol className="text-xs text-blue-700 mt-2 space-y-2 list-decimal list-inside">
                            <li>Choose your mode (Car, Bike, or Walking)</li>
                            <li>Set points by clicking the map or typing addresses</li>
                            <li>The engine finds closures affecting that specific mode</li>
                            <li>Valhalla calculates a path that navigates around the closures</li>
                        </ol>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
};

export default RoutingForm;
