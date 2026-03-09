"use client";

import { Marker, Popup, Polyline } from "react-leaflet";
import { divIcon } from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useTracking } from "@/lib/tracking-websocket-context";

const BASE_ICON_SIZE: [number, number] = [63, 36];
const BASE_ICON_ANCHOR: [number, number] = [31.5, 18];

const getZoomScale = (zoom: number): number => {
  if (zoom < 8) return 0.7;
  if (zoom < 10) return 0.9;
  if (zoom < 12) return 1.0;
  if (zoom < 14) return 1.2;
  return 1.5;
};

const createVehicleIcon = (brand: string, heading: number, zoomScale = 1) => {
  const brandLower = brand.toLowerCase();
  const url = `/img/${brandLower}.svg`;

  const scaledWidth = BASE_ICON_SIZE[0] * zoomScale;
  const scaledHeight = BASE_ICON_SIZE[1] * zoomScale;
  const scaledAnchorX = BASE_ICON_ANCHOR[0] * zoomScale;
  const scaledAnchorY = BASE_ICON_ANCHOR[1] * zoomScale;

  return divIcon({
    className: "vehicle-marker",
    html: `<img src="${url}" alt="${brand}" style="width:${scaledWidth}px;height:${scaledHeight}px;transform:rotate(${heading - 90}deg);transform-origin:50% 50%;" />`,
    iconSize: [scaledWidth, scaledHeight],
    iconAnchor: [scaledAnchorX, scaledAnchorY],
    popupAnchor: [0, -scaledAnchorY],
  });
};

interface VehicleMarkersProps {
  onFollowVehicle?: (vehicleId: number | null) => void;
  followingVehicleId?: number | null;
}

export function VehicleMarkers({ onFollowVehicle, followingVehicleId }: VehicleMarkersProps) {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [locationCache, setLocationCache] = useState<Map<number, [number, number]>>(new Map());
  const { positions, recalculateTruck, connected } = useTracking();

  useEffect(() => {
    fetch('/api/simulation/locations')
      .then(res => res.json())
      .then(data => {
        const cache = new Map<number, [number, number]>();
        data.locations?.forEach((loc: any) => {
          cache.set(loc.id, [loc.lat, loc.long]);
        });
        setLocationCache(cache);
      })
      .catch(err => console.error('Failed to load locations:', err));
  }, []);

  useEffect(() => {
    const handleZoom = () => {
      setCurrentZoom(map.getZoom());
    };

    map.on("zoomend", handleZoom);
    return () => {
      map.off("zoomend", handleZoom);
    };
  }, [map]);

  useEffect(() => {
    if (followingVehicleId !== null && followingVehicleId !== undefined) {
      const vehicle = positions.get(followingVehicleId);
      if (vehicle) {
        map.setView([vehicle.latitude, vehicle.longitude], currentZoom, {
          animate: true,
          duration: 0.5,
        });
      }
    }
  }, [positions, followingVehicleId, map, currentZoom]);

  const vehicles = Array.from(positions.values());
  const zoomScale = getZoomScale(currentZoom);

  const getRoutePath = (vehicle: any) => {
    if (locationCache.size === 0) return { current: [], future: [] };

    const allCoords = vehicle.location_sequence
      .map((locId: number) => locationCache.get(locId))
      .filter((coords: any) => coords !== undefined) as [number, number][];

    const currentIndex = vehicle.current_route_index || 0;

    const current = allCoords.slice(0, currentIndex + 2);
    const future = allCoords.slice(currentIndex + 1);

    return { current, future };
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'idle': return 'Oczekiwanie';
      case 'in_transit': return 'W trasie';
      case 'completed': return 'Zakończono';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'text-yellow-500';
      case 'in_transit': return 'text-green-500';
      case 'completed': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const selectedVehicle = selectedVehicleId !== null ? positions.get(selectedVehicleId) : null;
  const selectedRoutePath = selectedVehicle ? getRoutePath(selectedVehicle) : { current: [], future: [] };

  return (
    <>
      {!connected && (
        <div className="absolute top-4 right-4 z-[1000] rounded bg-red-500 px-4 py-2 text-white shadow">
          Rozłączono z serwerem
        </div>
      )}

      {selectedRoutePath.current.length > 0 && (
        <Polyline
          positions={selectedRoutePath.current}
          pathOptions={{
            color: '#3b82f6',
            weight: 4,
            opacity: 0.9,
          }}
        />
      )}

      {selectedRoutePath.future.length > 0 && (
        <Polyline
          positions={selectedRoutePath.future}
          pathOptions={{
            color: '#3b82f6',
            weight: 3,
            opacity: 0.4,
            dashArray: '10, 10',
          }}
        />
      )}

        {vehicles.map((vehicle) => {
          const icon = createVehicleIcon(vehicle.brand, vehicle.heading, zoomScale);
          const isFollowing = followingVehicleId === vehicle.truck_id;

          const currentSegment = vehicle.current_route_index + 1;
          const totalSegments = Math.max(1, vehicle.location_sequence.length - 1);
          const progressPercent = Math.round((currentSegment / totalSegments) * 100);

          return (
            <Marker
              key={vehicle.truck_id}
              position={[vehicle.latitude, vehicle.longitude]}
              icon={icon}
              eventHandlers={{
                popupopen: () => setSelectedVehicleId(vehicle.truck_id),
                popupclose: () => setSelectedVehicleId(null),
              }}
            >
              <Popup className="vehicle-popup" closeButton={false} keepInView={true} autoPan={false}>
                <div className="min-w-[300px] space-y-2">
                  <div className="flex items-start justify-between border-b border-white/10 pb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-white">{vehicle.registration_number}</div>
                      <div className="text-white/60 text-xs">{vehicle.brand}</div>
                    </div>
                    <button
                      onClick={() => map.closePopup()}
                      className="text-white/50 transition-colors hover:text-white"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/60">Status:</span>
                      <span className={`font-medium ${getStatusColor(vehicle.status)}`}>
                        {getStatusDisplay(vehicle.status)}
                      </span>
                    </div>
     
                    <div className="flex justify-between">
                      <span className="text-white/60">Kierunek:</span>
                      <span className="font-medium text-white">{Math.round(vehicle.heading)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Przebieg:</span>
                      <span className="font-medium text-white">{vehicle.odometer_km.toLocaleString()} km</span>
                    </div>
                    {vehicle.status === 'in_transit' && (
                      <>
                        <div className="border-white/10 border-t pt-1.5">
                          <div className="mb-1 flex justify-between text-white/60">
                            <span>Postęp:</span>
                            <span className="font-medium text-white">{progressPercent}%</span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-white/20">
                            <div
                              className="h-full rounded-full bg-white/60 transition-all"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                     
                      </>
                    )}
                  </div>

                  <div className="border-white/10 border-t pt-2">
                    {isFollowing ? (
                      <button
                        onClick={() => onFollowVehicle?.(null)}
                        className="w-full rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/20"
                      >
                        Przestań śledzić
                      </button>
                    ) : (
                      <button
                        onClick={() => onFollowVehicle?.(vehicle.truck_id)}
                        className="w-full rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/20"
                      >
                        Śledź
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

    </>
  );
}
