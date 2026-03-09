"use client";

import VehicleSearch from "./vehicle-search";
import type { TruckPosition } from "@/lib/tracking-websocket-context";

interface SearchBarProps {
  onSelectVehicle?: (vehicle: TruckPosition) => void;
}

export default function SearchBar({ onSelectVehicle }: SearchBarProps) {
  const handleSelectVehicle = (vehicle: TruckPosition) => {
    if (onSelectVehicle) {
      onSelectVehicle(vehicle);
    }
  };

  return (
    <div className="-translate-x-1/2 fixed top-auto bottom-4 left-1/2 z-[2000] w-[calc(100%-2rem)] max-w-md sm:top-4 sm:bottom-auto sm:w-96">
      <VehicleSearch onSelectVehicle={handleSelectVehicle} />
    </div>
  );
}
