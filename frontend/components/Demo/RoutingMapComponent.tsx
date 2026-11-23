"use client"
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Info, RotateCcw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { PersistedMapView } from "@/components/Map/PersistedMapView";

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Import the hook
import { useChicagoMapCenter } from '@/hooks/useMapCenter';
import { useLocationStatus } from '@/context/LocationContext';

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

import { Closure } from '@/services/api';

import { TransportationMode, doesClosureAffectMode, closureTypeEffects } from '@/utils/routing-utils';

interface RoutingMapComponentProps {
  sourcePoint: RoutePoint | null;
  destinationPoint: RoutePoint | null;
  transportationMode: TransportationMode;
  route: CalculatedRoute | null;
  directRoute: CalculatedRoute | null;
  closures: Closure[];
  onSourceSelect: (point: RoutePoint) => void;
  onDestinationSelect: (point: RoutePoint) => void;
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
      
      // Force invalidateSize to fix rendering issues
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }
  }, [map, mapCenter.loading, mapCenter.center, mapCenter.zoom]);

  // Also invalidate on initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 500);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
};

// Component to handle map events and render route elements
const MapEventHandler: React.FC<{
  sourcePoint: RoutePoint | null;
  destinationPoint: RoutePoint | null;
  transportationMode: TransportationMode;
  route: CalculatedRoute | null;
  directRoute: CalculatedRoute | null;
  closures: Closure[];
  onSourceSelect: (point: RoutePoint) => void;
  onDestinationSelect: (point: RoutePoint) => void;
  mapCenter: {
    center: [number, number];
    zoom: number;
    loading: boolean;
    usingGeolocation: boolean;
  };
}> = ({
  sourcePoint,
  destinationPoint,
  transportationMode,
  route,
  directRoute,
  closures,
  onSourceSelect,
  onDestinationSelect,
  mapCenter
}) => {
    const map = useMap();
    const layersRef = useRef<L.LayerGroup>(new L.LayerGroup());

    // Handle map click events
    useMapEvents({
      click: (e) => {
        if (!sourcePoint) {
          onSourceSelect({
            lat: e.latlng.lat,
            lng: e.latlng.lng,
            address: `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`
          });
        } else if (!destinationPoint) {
          onDestinationSelect({
            lat: e.latlng.lat,
            lng: e.latlng.lng,
            address: `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`
          });
        }
      },
    });


    const createClosureLayer = (closure: Closure): L.Layer[] => {
      const layers: L.Layer[] = [];
      const isActive = closure.status === 'active';
      const affectsCurrentMode = doesClosureAffectMode(closure, transportationMode);

      let color: string;
      let opacity: number;
      let className: string;

      if (isActive && affectsCurrentMode) {
        color = '#ef4444';
        opacity = 0.9;
        className = 'relevant-active-closure';
      } else if (isActive && !affectsCurrentMode) {
        color = '#10b981';
        opacity = 0.6;
        className = 'irrelevant-active-closure';
      } else {
        color = '#9ca3af';
        opacity = 0.4;
        className = 'inactive-closure';
      }

      if (closure.geometry.type === 'Point') {
        const [lng, lat] = closure.geometry.coordinates as number[];
        const icon = L.divIcon({
          className: 'custom-closure-icon',
          html: `
          <div class="closure-marker ${className}">
            <div class="closure-marker-inner">⚠</div>
            ${isActive && affectsCurrentMode ? '<div class="blocking-indicator">🚫</div>' : ''}
            ${isActive && !affectsCurrentMode ? '<div class="safe-indicator">✓</div>' : ''}
          </div>
        `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([lat, lng], { icon })
          .bindPopup(`
          <div class="closure-popup">
            <div class="flex items-center space-x-2 mb-2">
              <h3 class="font-semibold text-gray-900">${closure.description}</h3>
              ${isActive && affectsCurrentMode ? '<span class="text-red-600 font-bold">🚫 BLOCKS</span>' : ''}
              ${isActive && !affectsCurrentMode ? '<span class="text-green-600 font-bold">✓ SAFE</span>' : ''}
            </div>
          </div>
        `);
        layers.push(marker);
      } else if (closure.geometry.type === 'LineString') {
        const coordinates = (closure.geometry.coordinates as number[][]).map(([lng, lat]) => [lat, lng] as [number, number]);
        const polyline = L.polyline(coordinates, {
          color,
          weight: isActive ? (affectsCurrentMode ? 6 : 4) : 3,
          opacity,
          dashArray: isActive ? undefined : '5, 5',
          className: className
        }).bindPopup(`
        <div class="closure-popup">
          <div class="flex items-center space-x-2 mb-2">
            <h3 class="font-semibold text-gray-900">${closure.description}</h3>
          </div>
        </div>
      `);
        layers.push(polyline);
      }
      return layers;
    };

    useEffect(() => {
      const layerGroup = layersRef.current;
      layerGroup.clearLayers();

      if (sourcePoint) {
        const sourceIcon = L.divIcon({
          className: 'custom-marker source-marker',
          html: '<div style="background-color: #22c55e; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.3);">S</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        layerGroup.addLayer(L.marker([sourcePoint.lat, sourcePoint.lng], { icon: sourceIcon }));
      }

      if (destinationPoint) {
        const destIcon = L.divIcon({
          className: 'custom-marker dest-marker',
          html: '<div style="background-color: #ef4444; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.3);">D</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        layerGroup.addLayer(L.marker([destinationPoint.lat, destinationPoint.lng], { icon: destIcon }));
      }

      if (directRoute && directRoute.coordinates.length > 1) {
        layerGroup.addLayer(L.polyline(directRoute.coordinates, { color: '#6b7280', weight: 3, opacity: 0.5, dashArray: '10, 10' }));
      }

      if (route && route.coordinates.length > 1) {
        layerGroup.addLayer(L.polyline(route.coordinates, { color: '#2563eb', weight: 6, opacity: 1.0 }));
      }

      closures.forEach(closure => {
        const closureLayers = createClosureLayer(closure);
        closureLayers.forEach(layer => layerGroup.addLayer(layer));
      });

      layerGroup.addTo(map);

      if ((sourcePoint && destinationPoint) || route) {
        const bounds = L.latLngBounds([]);
        if (sourcePoint) bounds.extend([sourcePoint.lat, sourcePoint.lng]);
        if (destinationPoint) bounds.extend([destinationPoint.lat, destinationPoint.lng]);
        if (route && route.coordinates.length > 0) route.coordinates.forEach(coord => bounds.extend(coord));
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
      }

      return () => { layerGroup.clearLayers(); };
    }, [sourcePoint, destinationPoint, transportationMode, route, directRoute, closures, map]);

    return null;
  };

const RoutingMapComponent: React.FC<RoutingMapComponentProps> = ({
  sourcePoint,
  destinationPoint,
  transportationMode,
  route,
  directRoute,
  closures,
  onSourceSelect,
  onDestinationSelect
}) => {
  const mapCenter = useChicagoMapCenter(true);
  const { setStatus } = useLocationStatus();

  useEffect(() => {
    setStatus({
      usingGeolocation: mapCenter.usingGeolocation,
      error: mapCenter.error,
      loading: mapCenter.loading,
    });
  }, [mapCenter.usingGeolocation, mapCenter.error, mapCenter.loading, setStatus]);

  const getTransportationModeInfo = (mode: TransportationMode) => {
    switch (mode) {
      case 'auto': return { icon: '🚗', label: 'Driving' };
      case 'bicycle': return { icon: '🚲', label: 'Cycling' };
      case 'pedestrian': return { icon: '🚶', label: 'Walking' };
    }
  };

  const modeInfo = getTransportationModeInfo(transportationMode);

  return (
    <div className="relative w-full h-full">
      <style jsx global>{`
        .closure-marker {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: bold;
          box-shadow: 0 3px 10px rgba(0,0,0,0.3);
          border: 3px solid white;
          position: relative;
        }
        .closure-marker.relevant-active-closure { background-color: #ef4444; color: white; }
        .closure-marker.irrelevant-active-closure { background-color: #10b981; color: white; }
        .closure-marker.inactive-closure { background-color: #9ca3af; color: white; }
        .closure-marker-inner { animation: pulse 2s infinite; }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .custom-marker { background: transparent !important; border: none !important; box-shadow: none !important; }
      `}</style>

      {mapCenter.loading && (
        <div className="absolute inset-0 z-20 bg-white/90 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Getting your location...</p>
          </div>
        </div>
      )}

      <MapContainer center={mapCenter.center} zoom={mapCenter.zoom} className="h-full w-full" zoomControl={true}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapEventHandler
          sourcePoint={sourcePoint}
          destinationPoint={destinationPoint}
          transportationMode={transportationMode}
          route={route}
          directRoute={directRoute}
          closures={closures}
          onSourceSelect={onSourceSelect}
          onDestinationSelect={onDestinationSelect}
          mapCenter={mapCenter}
        />
        <PersistedMapView mapCenter={mapCenter} />
      </MapContainer>

      {/* Map Legend: Ultra-Compact Circular Icon Button - Positioned top-left, perfectly stacked with zoom controls */}
      <div className="absolute top-[112px] left-[24px] z-[800] drop-shadow-lg md:drop-shadow-none">
        <Popover>
          <PopoverTrigger className="flex items-center justify-center bg-[#E5484D] hover:bg-[#D64045] active:scale-90 text-white w-9 h-9 rounded-full shadow-2xl border border-black/10 transition-all duration-200 group">
            <Info className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" sideOffset={12} className="w-64 p-0 bg-white/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl border border-white/40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100/50">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Map Legend</h3>
                <Info className="w-3 h-3 text-gray-300" />
              </div>

              <div className="grid gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow-sm">S</div>
                    <span className="text-[11px] font-medium text-gray-600">Start Location</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow-sm">D</div>
                    <span className="text-[11px] font-medium text-gray-600">Destination</span>
                  </div>
                </div>

                <div className="h-px bg-gray-50"></div>

                <div className="space-y-2.5">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-1 bg-blue-600 rounded-full"></div>
                    <span className="text-[11px] font-medium text-gray-600">Optimal Route</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-1 bg-gray-200 rounded-full overflow-hidden relative">
                      <div className="absolute inset-0 bg-white/50" style={{ width: '50%' }}></div>
                    </div>
                    <span className="text-[11px] font-medium text-gray-600">Direct Route</span>
                  </div>
                </div>

                <div className="h-px bg-gray-50"></div>

                <div className="space-y-2.5">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] shadow-sm animate-pulse-slow">⚠</div>
                    <span className="text-[11px] font-bold text-red-600">Blocks Path</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-[8px] shadow-sm">⚠</div>
                    <span className="text-[11px] font-bold text-green-600">Safe Path</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center text-white text-[8px] shadow-sm">⚠</div>
                    <span className="text-[11px] font-medium text-gray-500">Inactive</span>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-3 border-t border-gray-100/50 space-y-2">
                <div className="flex items-center space-x-2 px-2 py-1.5 bg-blue-50/50 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-[9px] font-black text-blue-700 uppercase tracking-widest">Smart Filtering</span>
                </div>
                <div className="px-2 space-y-1.5">
                  <p className="text-[10px] text-gray-600 leading-tight">
                    Only closures affecting <span className="font-bold text-gray-900 underline decoration-blue-200">{modeInfo.label.toLowerCase()}</span> are avoided in routing.
                  </p>
                  <p className="text-[9px] text-gray-400 italic">
                    Example: Road construction affects auto/bicycle but not pedestrian
                  </p>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

    </div>
  );
};

export default RoutingMapComponent;
