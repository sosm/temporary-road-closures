"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

const STORAGE_KEY = "temporary-road-closures:map-view";

interface MapCenter {
  center: [number, number];
  zoom: number;
  loading: boolean;
}

export function PersistedMapView({ mapCenter }: { mapCenter: MapCenter }) {
  const map = useMap();
  const initialized = useRef(false);
  const isRestoring = useRef(false);

  useEffect(() => {
    if (mapCenter.loading || initialized.current) return;

    initialized.current = true;

    let center = mapCenter.center;
    let zoom = mapCenter.zoom;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const view = JSON.parse(saved) as {
          center?: unknown;
          zoom?: unknown;
        };

        if (
          Array.isArray(view.center) &&
          view.center.length === 2 &&
          view.center.every(Number.isFinite) &&
          Number.isFinite(view.zoom)
        ) {
          center = view.center as [number, number];
          zoom = view.zoom as number;
        }
      }
    } catch {
      // Ignore unavailable or invalid storage.
    }

    isRestoring.current = true;
    map.setView(center, zoom);
    isRestoring.current = false;

  }, [
    map,
    mapCenter.loading,
    mapCenter.center,
    mapCenter.zoom,
  ]);

  useEffect(() => {
    const saveView = () => {
      if (!initialized.current || isRestoring.current) return;

      const center = map.getCenter();

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            center: [center.lat, center.lng],
            zoom: map.getZoom(),
          }),
        );
      } catch {
        // Ignore unavailable or full storage.
      }
    };

    map.on("moveend", saveView);
    map.on("zoomend", saveView);

    return () => {
      map.off("moveend", saveView);
      map.off("zoomend", saveView);
    };
  }, [map]);

  return null;
}
