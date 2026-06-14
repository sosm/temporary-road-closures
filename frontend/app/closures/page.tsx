// app/closures/page.tsx 
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Toaster } from '@/components/ui/sonner';
import { ClosuresProvider, useClosures } from '@/context/ClosuresContext';
import { closuresApi } from '@/services/api';
import ClientOnly from '@/components/ClientOnly';
import { LogIn, Info, MapPin, Route as RouteIcon, Edit3, TriangleAlert, Target, X, Check } from 'lucide-react';
import L from 'leaflet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// // Dynamically import MapComponent to avoid SSR issues
// const MapComponent = dynamic(
//   () => import('@/components/Map/MapComponent'),
//   {
//     ssr: false,
//     loading: () => (
//       <div className="h-full w-full bg-gray-100 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
//           <p className="text-gray-600">Loading map...</p>
//         </div>
//       </div>
//     )
//   }
// );

// Dynamically import all components that use browser APIs
const Layout = dynamic(() => import('@/components/Layout/Layout'), { ssr: false });
const ClosureForm = dynamic(() => import('@/components/Forms/ClosureForm'), { ssr: false });
const EditClosureForm = dynamic(() => import('@/components/Forms/EditClosureForm'), { ssr: false });
const MapComponent = dynamic(() => import('@/components/Map/MapComponent'), { ssr: false });

// Loading component
const LoadingSpinner = () => (
  <div className="h-screen w-full bg-background flex items-center justify-center">
    <div className="text-center space-y-6">
      <div className="relative flex items-center justify-center">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="absolute animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Loading application...</h2>
        <p className="text-muted-foreground text-sm">Preparing your road closure dashboard</p>
      </div>
    </div>
  </div>
);



// Point Selection Instructions Component
const PointSelectionInstructions: React.FC<{
  isSelecting: boolean;
  pointCount: number;
  hasRoute: boolean;
  routeInfo?: { distance_km: number; points_count: number };
  onClear: () => void;
  onFinish: () => void;
  geometryType: 'Point' | 'LineString';
}> = ({ isSelecting, pointCount, hasRoute, routeInfo, onClear, onFinish, geometryType }) => {
  if (!isSelecting) return null;

  const getInstructionText = () => {
    if (geometryType === 'Point') {
      return pointCount === 0 ? "Click on the map to select a point location" : "Point location selected";
    } else {
      return pointCount === 0 ? "Click on the map to start selecting points" :
        pointCount === 1 ? "Add at least one more point to calculate route" :
          pointCount >= 2 && !hasRoute && !routeInfo ? "Calculating route with Valhalla..." :
            hasRoute && routeInfo ? `Route calculated: ${routeInfo.points_count} points, ${routeInfo.distance_km.toFixed(2)} km` :
              "Select points for road segment";
    }
  };

  const GeometryIcon = geometryType === 'Point' ? Target : RouteIcon;

  return (
    <Card className="fixed md:bottom-6 bottom-28 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-[calc(100vw-2rem)] md:max-w-md border-2 border-primary/50 bg-background/95 backdrop-blur-sm shadow-none animate-in slide-in-from-bottom-4">
      <CardContent className="p-4">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${geometryType === 'Point' ? 'bg-orange-500' : 'bg-primary'}`}></div>
              <GeometryIcon className={geometryType === 'Point' ? 'text-orange-500' : 'text-primary'} size={18} />
              <span className="font-semibold text-sm">
                {geometryType === 'Point' ? 'Point' : 'Road Segment'} Selection
              </span>
            </div>
            <Badge variant="secondary" className="font-mono">
              {pointCount}/{geometryType === 'Point' ? '1' : '2+'}
            </Badge>
          </div>

          <div className="text-sm text-foreground/80 font-medium">
            {getInstructionText()}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {geometryType === 'Point' ? (
                <span className="flex items-center gap-1"><Target size={10} /> Single Location</span>
              ) : hasRoute ? (
                <span className="flex items-center gap-1 text-green-600"><Check size={10} /> Valhalla Route</span>
              ) : pointCount >= 2 ? (
                <span className="animate-pulse">Calculating Path...</span>
              ) : (
                "Select points on map"
              )}
            </div>
            <div className="flex gap-2">
              {pointCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClear}
                  className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive rounded-full px-4"
                >
                  Clear
                </Button>
              )}
              <Button 
                size="sm" 
                onClick={onFinish}
                className={`h-8 text-xs font-bold rounded-full px-6 ${geometryType === 'Point' ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
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

// Route Status Component
const RouteStatus: React.FC<{
  isRouting: boolean;
  hasRoute: boolean;
  routeError?: string;
  routeInfo?: { distance_km: number; points_count: number };
  geometryType: 'Point' | 'LineString';
}> = ({ isRouting, hasRoute, routeError, routeInfo, geometryType }) => {
  if (geometryType === 'Point') return null; // No routing for points
  if (!isRouting && !hasRoute && !routeError) return null;

  return (
    <div className="fixed top-20 right-4 z-[1050] flex flex-col items-end gap-2 max-w-sm">
      {isRouting && (
        <Alert className="bg-primary text-primary-foreground border-none shadow-lg py-2 px-3 flex items-center gap-3">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
          <AlertDescription className="text-xs font-semibold">
            Calculating route with Valhalla...
          </AlertDescription>
        </Alert>
      )}

      {routeError && (
        <Alert variant="destructive" className="shadow-lg py-2 px-3 border-none flex items-center gap-3">
          <TriangleAlert className="w-4 h-4" />
          <AlertDescription className="text-xs font-semibold">
            {routeError}
          </AlertDescription>
        </Alert>
      )}

      {hasRoute && routeInfo && (
        <Alert className="bg-green-600 text-white border-none shadow-lg py-2 px-3 flex items-center gap-3">
          <RouteIcon className="w-4 h-4" />
          <AlertDescription className="text-xs font-semibold leading-none text-white">
            Route Ready: {routeInfo.distance_km.toFixed(2)}km ({routeInfo.points_count} pts)
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// Edit Status Component
const EditStatus: React.FC<{
  isEditing: boolean;
  editingClosure: any;
  onCancel: () => void;
}> = ({ isEditing, editingClosure, onCancel }) => {
  if (!isEditing || !editingClosure) return null;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[1050] max-w-md">
      <Alert className="bg-orange-600 text-white border-none shadow-lg py-2 px-4 flex items-center gap-4">
        <Edit3 className="w-4 h-4" />
        <AlertDescription className="text-sm font-semibold">
          Editing Closure #{editingClosure.id}
        </AlertDescription>
        <Button variant="link" size="sm" onClick={onCancel} className="text-white underline p-0 h-auto">
          Cancel
        </Button>
      </Alert>
    </div>
  );
};

function ClosuresPageContent() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [selectedPoints, setSelectedPoints] = useState<L.LatLng[]>([]);
  const [isSelectingPoints, setIsSelectingPoints] = useState(false);
  const [geometryType, setGeometryType] = useState<'Point' | 'LineString'>('LineString');
  const [isFormMinimized, setIsFormMinimized] = useState(false);
  const [isEditFormMinimized, setIsEditFormMinimized] = useState(false);

  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');

  // Move useClosures hook here, before any conditional returns
  const { state, stopEditingClosure, selectClosure } = useClosures();
  const { editingClosure, editLoading } = state;

  // Auto-select closure when a ?highlight=<id> permalink is loaded
  useEffect(() => {
    if (!highlightId) return;
    const id = parseInt(highlightId, 10);
    if (isNaN(id)) return;
    closuresApi.getClosure(id)
      .then(closure => selectClosure(closure))
      .catch(() => {});
  }, [highlightId, selectClosure]);

  // Route state 
  const [routeState, setRouteState] = useState<{
    isRouting: boolean;
    hasRoute: boolean;
    routeError?: string;
    routeInfo?: { distance_km: number; points_count: number; coordinates: [number, number][] };
  }>({
    isRouting: false,
    hasRoute: false
  });

  // Consolidated event listeners
  useEffect(() => {
    const handleClearPoints = () => {
      setSelectedPoints([]);
      setRouteState({
        isRouting: false,
        hasRoute: false
      });
    };

    const handleFinishSelection = () => {
      setIsSelectingPoints(false);
    };

    // Consolidated geometry type change handler
    const handleGeometryTypeChange = (event: CustomEvent) => {
      const newGeometryType = event.detail.geometryType;
      setGeometryType(newGeometryType);

      // Clear points when switching between Point and LineString
      if (newGeometryType !== geometryType) {
        setSelectedPoints([]);
        setRouteState({
          isRouting: false,
          hasRoute: false
        });
      }
    };

    window.addEventListener('clearPoints', handleClearPoints);
    window.addEventListener('finishSelection', handleFinishSelection);
    window.addEventListener('geometryTypeChanged', handleGeometryTypeChange as EventListener);

    // Listen for sidebar's Report Closure button
    const handleSidebarToggle = () => {
      // Toggle form open — reuse same logic as handleToggleForm
      setIsFormOpen(prev => {
        if (prev) {
          setSelectedPoints([]);
          setIsSelectingPoints(false);
          setRouteState({ isRouting: false, hasRoute: false });
          setGeometryType('LineString');
        }
        if (!prev && isEditFormOpen) {
          setIsEditFormOpen(false);
          stopEditingClosure();
        }
        return !prev;
      });
    };
    window.addEventListener('toggle-closure-form', handleSidebarToggle);

    return () => {
      window.removeEventListener('clearPoints', handleClearPoints);
      window.removeEventListener('finishSelection', handleFinishSelection);
      window.removeEventListener('geometryTypeChanged', handleGeometryTypeChange as EventListener);
      window.removeEventListener('toggle-closure-form', handleSidebarToggle);
    };
  }, [geometryType]);

  const handleToggleForm = () => {
    if (isFormOpen) {
      setSelectedPoints([]);
      setIsSelectingPoints(false);
      setRouteState({
        isRouting: false,
        hasRoute: false
      });
      setGeometryType('LineString'); // Reset to default
    }
    setIsFormOpen(!isFormOpen);

    if (!isFormOpen && isEditFormOpen) {
      setIsEditFormOpen(false);
      stopEditingClosure();
    }
  };

  const handleToggleEditForm = () => {
    setIsEditFormOpen(!isEditFormOpen);

    if (isEditFormOpen) {
      stopEditingClosure();
    }

    if (!isEditFormOpen && isFormOpen) {
      setIsFormOpen(false);
      setSelectedPoints([]);
      setIsSelectingPoints(false);
      setRouteState({
        isRouting: false,
        hasRoute: false
      });
    }
  };

  const handleEditClosure = (closureId: number) => {
    setIsEditFormOpen(true);

    if (isFormOpen) {
      setIsFormOpen(false);
      setSelectedPoints([]);
      setIsSelectingPoints(false);
      setRouteState({
        isRouting: false,
        hasRoute: false
      });
    }
  };

  const handlePointsSelect = () => {
    setIsSelectingPoints(true);
    setIsFormMinimized(true);
    setIsEditFormMinimized(true);
    setRouteState({
      isRouting: false,
      hasRoute: false
    });
  };

  const handleMapClick = (latlng: L.LatLng) => {
    if (isSelectingPoints && isFormOpen && !isEditFormOpen) {
      // For Point geometry, replace the existing point; for LineString, add to the array
      if (geometryType === 'Point') {
        setSelectedPoints([latlng]); // Replace with single point
      } else {
        setSelectedPoints(prev => [...prev, latlng]); // Add to array
      }

      // Reset route state when new points are added
      setRouteState({
        isRouting: false,
        hasRoute: false
      });
    }
  };

  const handleClearPoints = () => {
    setSelectedPoints([]);
    setIsFormMinimized(false);
    setIsEditFormMinimized(false);
    setRouteState({
      isRouting: false,
      hasRoute: false
    });
  };

  const handleFinishSelection = () => {
    setIsSelectingPoints(false);
    setIsFormMinimized(false);
    setIsEditFormMinimized(false);
  };

  // Handle route calculation from MapComponent
  const handleRouteCalculated = (coordinates: [number, number][], stats: any) => {
    // Only handle route calculation for LineString geometry
    if (geometryType !== 'LineString') return;

    console.log('📍 Route calculated in page:', {
      pointsCount: coordinates.length,
      distance: stats.distance_km
    });

    setRouteState({
      isRouting: false,
      hasRoute: true,
      routeInfo: {
        distance_km: stats.distance_km,
        points_count: coordinates.length,
        coordinates
      }
    });

    const event = new CustomEvent('routeCalculated', {
      detail: { coordinates, stats }
    });
    window.dispatchEvent(event);
  };

  // Handle routing state changes
  const handleRoutingStart = () => {
    if (geometryType === 'LineString') {
      setRouteState(prev => ({
        ...prev,
        isRouting: true,
        hasRoute: false,
        routeError: undefined
      }));
    }
  };

  const handleRoutingError = (error: string) => {
    if (geometryType === 'LineString') {
      setRouteState({
        isRouting: false,
        hasRoute: false,
        routeError: error
      });
    }
  };

  return (
    <div className="h-screen">
      <Layout
        onToggleForm={handleToggleForm}
        isFormOpen={isFormOpen}
        isEditFormOpen={isEditFormOpen}
        isFormMinimized={isFormMinimized || isEditFormMinimized}
        onEditClosure={handleEditClosure}
      >
        <MapComponent
          onMapClick={handleMapClick}
          selectedPoints={selectedPoints}
          isSelecting={isSelectingPoints && isFormOpen && !isEditFormOpen}
          onClearPoints={handleClearPoints}
          onFinishSelection={handleFinishSelection}
          onRouteCalculated={handleRouteCalculated}
          geometryType={geometryType}
        />

        {/* Create Form Sidebar */}
        <ClosureForm
          isOpen={isFormOpen}
          isMinimized={isFormMinimized}
          onToggleMinimize={() => setIsFormMinimized(!isFormMinimized)}
          onClose={handleToggleForm}
          selectedPoints={selectedPoints}
          onPointsSelect={handlePointsSelect}
          isSelectingPoints={isSelectingPoints}
        />

        {/* Edit Form Sidebar */}
        {editingClosure && (
          <EditClosureForm
            isOpen={isEditFormOpen}
            isMinimized={isEditFormMinimized}
            onToggleMinimize={() => setIsEditFormMinimized(!isEditFormMinimized)}
            onClose={handleToggleEditForm}
            closure={editingClosure}
          />
        )}
      </Layout>

      {/* Auth Notice for non-authenticated users */}

      {/* Edit Status Indicator */}
      <EditStatus
        isEditing={isEditFormOpen && !!editingClosure}
        editingClosure={editingClosure}
        onCancel={handleToggleEditForm}
      />

      {/* Route Status Indicators */}
      <RouteStatus
        isRouting={routeState.isRouting}
        hasRoute={routeState.hasRoute}
        routeError={routeState.routeError}
        routeInfo={routeState.routeInfo}
        geometryType={geometryType}
      />

      {/* Point Selection Instructions */}
      <PointSelectionInstructions
        isSelecting={isSelectingPoints && isFormOpen && !isEditFormOpen}
        pointCount={selectedPoints.length}
        hasRoute={routeState.hasRoute}
        routeInfo={routeState.routeInfo}
        onClear={handleClearPoints}
        onFinish={handleFinishSelection}
        geometryType={geometryType}
      />



      {/* Point Selection Status - Fixed position when create form is open */}
      {isSelectingPoints && isFormOpen && !isEditFormOpen && (
        <div className="fixed top-20 right-4 md:right-[25rem] z-[1050]">
          <Alert className="bg-primary text-primary-foreground border-none shadow-xl py-2 px-4 flex items-center gap-3">
            {geometryType === 'Point' ? <Target className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
            <span className="text-sm font-bold">
              {geometryType === 'Point' ? (
                selectedPoints.length === 0 ? 'Click map to select location' : 'Location Selected'
              ) : (
                selectedPoints.length === 0 ? 'Click map to define path' :
                  selectedPoints.length === 1 ? '1 point - select next' :
                    `${selectedPoints.length} points defined`
              )}
              {routeState.hasRoute && routeState.routeInfo && geometryType === 'LineString' && (
                <Badge variant="outline" className="ml-2 bg-green-500/20 text-white border-green-400">
                  {routeState.routeInfo.distance_km.toFixed(2)}km
                </Badge>
              )}
            </span>
          </Alert>
        </div>
      )}

      {/* Edit Form Status - Fixed position when edit form is open */}
      {isEditFormOpen && editingClosure && (
        <div className="fixed top-20 right-4 md:right-[25rem] z-[1050]">
          <Alert className="bg-orange-600 text-white border-none shadow-xl py-2 px-4 flex items-center gap-3">
            <Edit3 className="w-4 h-4" />
            <span className="text-sm font-bold truncate max-w-[200px]">
              Editing: {editingClosure.description}
            </span>
          </Alert>
        </div>
      )}

      {/* Geometry Type Indicator */}
      {isSelectingPoints && isFormOpen && !isEditFormOpen && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[1050]">
          <div className="bg-background/90 backdrop-blur-md border border-border rounded-full shadow-2xl px-6 py-2 flex items-center gap-3">
            {geometryType === 'Point' ? (
              <>
                <Target className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-black uppercase tracking-widest text-orange-700">Point Mode</span>
              </>
            ) : (
              <>
                <RouteIcon className="w-4 h-4 text-primary" />
                <span className="text-xs font-black uppercase tracking-widest text-primary">Path Mode</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Valhalla Integration Notice - Only for LineString */}
      {geometryType === 'LineString' && selectedPoints.length >= 2 && !routeState.hasRoute && !routeState.isRouting && isFormOpen && !isEditFormOpen && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[1050]">
          <Alert className="bg-amber-500 text-amber-950 border-none shadow-lg py-2 px-4 font-bold text-xs ring-2 ring-amber-400/20">
            <RouteIcon className="w-4 h-4 mr-2 inline" />
            Waiting for Valhalla path...
          </Alert>
        </div>
      )}

      {/* Route Success Notice - Only for LineString */}
      {geometryType === 'LineString' && routeState.hasRoute && routeState.routeInfo && isFormOpen && !isEditFormOpen && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[1050]">
          <Alert className="bg-green-600 text-white border-none shadow-lg py-2 px-4 font-bold text-xs">
            <RouteIcon className="w-4 h-4 mr-2 inline" />
            Path optimized: {routeState.routeInfo.distance_km.toFixed(2)}km
          </Alert>
        </div>
      )}

      {/* Point Selection Success Notice - Only for Point */}
      {geometryType === 'Point' && selectedPoints.length === 1 && isFormOpen && !isEditFormOpen && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[1050]">
          <Alert className="bg-orange-600 text-white border-none shadow-lg py-2 px-4 font-bold text-xs">
            <Target className="w-4 h-4 mr-2 inline" />
            Location selected
          </Alert>
        </div>
      )}

      {/* Form Conflict Warning */}
      {isFormOpen && isEditFormOpen && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100]">
          <Alert variant="destructive" className="shadow-2xl border-2 border-white/20">
            <TriangleAlert className="w-4 h-4" />
            <AlertTitle>Conflict Detected</AlertTitle>
            <AlertDescription>
              Cannot have both create and edit forms open.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Loading State for Edit */}
      {editLoading && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40 bg-orange-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span className="text-sm font-medium">
              {editingClosure ? 'Updating closure...' : 'Loading closure for editing...'}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ClosuresPage() {
  return (
    <ClientOnly fallback={<LoadingSpinner />}>
      <ClosuresPageContent />
    </ClientOnly>
  );
}
