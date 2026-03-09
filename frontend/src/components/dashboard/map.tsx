"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import dynamic from "next/dynamic";
import { useState } from "react";
import "leaflet/dist/leaflet.css";

const ZoomControls = dynamic(
  () => import("./zoom"),
  { ssr: false }
);

const VehicleMarkers = dynamic(
  () => import("./vehicle-markers").then((mod) => ({ default: mod.VehicleMarkers })),
  { ssr: false }
);

const RoutePolylines = dynamic(
  () => import("./route-polylines"),
  { ssr: false }
);

const MAP_CONFIG = {
  center: [52.237_049, 19.017_532] as [number, number],
  zoom: 7,
  tileUrl: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  tileSize: 256,
};

interface MapProps {
  onFollowVehicle?: (vehicleId: number) => void;
  followingVehicleId?: number | null;
  onUnfollow?: () => void;
}

export default function Map({ onFollowVehicle, followingVehicleId: externalFollowingId, onUnfollow }: MapProps) {
  const [internalFollowingId, setInternalFollowingId] = useState<number | null>(null);
  const followingVehicleId = externalFollowingId ?? internalFollowingId;

  const handleFollowVehicle = (vehicleId: number | null) => {
    setInternalFollowingId(vehicleId);
    if (onFollowVehicle && vehicleId !== null) {
      onFollowVehicle(vehicleId);
    } else if (vehicleId === null && onUnfollow) {
      onUnfollow();
    }
  };

  const handleUnfollow = () => {
    console.log("Map: handleUnfollow called");
    setInternalFollowingId(null);
    onUnfollow?.();
  };

  return (
    <MapContainer
      center={MAP_CONFIG.center}
      zoom={MAP_CONFIG.zoom}
      style={{ backgroundColor: "#000000" }}
      className="h-screen w-screen"
    >
      <TileLayer
        url={MAP_CONFIG.tileUrl}
        tileSize={MAP_CONFIG.tileSize}
        zoomOffset={0}
      />
      <ZoomControls
        followingVehicleId={followingVehicleId}
        onUnfollowVehicle={handleUnfollow}
      />
      <RoutePolylines />
      <VehicleMarkers
        onFollowVehicle={handleFollowVehicle}
        followingVehicleId={followingVehicleId}
      />
    </MapContainer>
  );
}
