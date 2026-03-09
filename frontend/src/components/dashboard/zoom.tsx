"use client";

import { useCallback } from "react";
import { useMap } from "react-leaflet";
import { Plus, Minus, MapPinOff } from "lucide-react";

interface ZoomControlsProps {
  followingVehicleId?: number | null;
  onUnfollowVehicle?: () => void;
}

export default function ZoomControls({ followingVehicleId, onUnfollowVehicle }: ZoomControlsProps) {
  const map = useMap();

  const handleZoomIn = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    map.setZoom(map.getZoom() + 1);
  }, [map]);

  const handleZoomOut = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    map.setZoom(map.getZoom() - 1);
  }, [map]);

  return (
    <div className="fixed top-4 right-4 z-1000 flex flex-row items-start gap-4">
      {followingVehicleId && (
        <div className="glass-card fade-in slide-in-from-left-2 flex animate-in items-center justify-center overflow-hidden rounded-2xl ring-1 ring-white/10 duration-200">
          <button
            type="button"
            aria-label="Stop following vehicle"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("Unfollow button clicked");
              onUnfollowVehicle?.();
            }}
            className="group relative flex h-12 w-12 items-center justify-center text-red-400 transition hover:bg-red-500/20 active:scale-95"
            title="Przestań śledzić pojazd"
          >
            <MapPinOff className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>
        </div>
      )}

      <div
        id="app-zoom"
        className="glass-card flex flex-col items-center justify-center gap-1 overflow-hidden rounded-3xl ring-1 ring-white/10"
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={handleZoomIn}
          className="relative flex h-12 w-12 items-center justify-center text-white transition hover:bg-white/10 active:scale-95"
        >
          <Plus className="h-5 w-5" />
        </button>

        <div className="h-px w-8 border-white/30 border-t" />

        <button
          type="button"
          aria-label="Zoom out"
          onClick={handleZoomOut}
          className="relative flex h-12 w-12 items-center justify-center text-white transition hover:bg-white/10 active:scale-95"
        >
          <Minus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
