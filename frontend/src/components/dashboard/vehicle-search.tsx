"use client";

import { useState, useCallback, useMemo } from "react";
import { Search, X } from "lucide-react";
import { useTracking } from "@/lib/tracking-websocket-context";
import type { TruckPosition } from "@/lib/tracking-websocket-context";
import Image from "next/image";

interface VehicleSearchProps {
  onSelectVehicle: (vehicle: TruckPosition) => void;
}

export default function VehicleSearch({ onSelectVehicle }: VehicleSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { positions } = useTracking();

  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim() || positions.size === 0) return [];

    const query = searchQuery.toLowerCase();
    return Array.from(positions.values())
      .filter(vehicle =>
        vehicle.registration_number.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [searchQuery, positions]);

  const handleSelectVehicle = useCallback((vehicle: TruckPosition) => {
    onSelectVehicle(vehicle);
    setSearchQuery("");
    setIsOpen(false);
  }, [onSelectVehicle]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsOpen(value.trim().length > 0);
  };

  const handleClear = () => {
    setSearchQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative z-[2000] w-full max-w-md">
      <div className="glass-card overflow-hidden rounded-xl transition-all duration-200">
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3.5 h-5 w-5 text-white/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            placeholder="Szukaj po nr. rejestracyjnym..."
            className="w-full bg-transparent py-3 pr-10 pl-10 text-sm font-medium text-white outline-none placeholder:text-white/40 transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={handleClear}
              className="-translate-y-1/2 absolute top-1/2 right-3 text-white/50 transition-all duration-150 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {isOpen && filteredVehicles.length > 0 && (
        <div className="glass-card fade-in slide-in-from-top-2 absolute top-full right-0 left-0 mt-2 animate-in overflow-hidden rounded-xl duration-200 shadow-2xl">
          <div className="max-h-[420px] overflow-y-auto py-1.5">
            {filteredVehicles.map((vehicle, index) => (
              <button
                key={vehicle.truck_id}
                onClick={() => handleSelectVehicle(vehicle)}
                className="group flex w-full items-center gap-3 px-3.5 py-3 transition-all duration-150 hover:bg-white/10 active:bg-white/15"
                style={{
                  animation: `slideIn 0.2s ease-out ${index * 0.05}s both`,
                }}
                >
                <div className="shrink-0 w-12 h-7 relative flex items-center justify-center">
                  <Image
                    src={`/${vehicle.brand.toLowerCase()}.svg`}
                    alt={vehicle.brand}
                    width={48}
                    height={28}
                    className={`object-contain filter brightness-90 group-hover:brightness-110 transition-all ${vehicle.brand.toLowerCase() == "volvo" ? "invert" : ""}`}
                  />
                </div>

                <div className="flex-1 text-left min-w-0">
                  <div className="font-mono font-bold text-sm text-white tracking-wide">
                    {vehicle.registration_number}
                  </div>
                  <div className="flex items-center gap-2 text-white/50 text-xs mt-0.5">
                    <span className="font-medium">{vehicle.brand}</span>
                    <span className="text-white/30">•</span>
                    <span className="truncate">{Math.round(vehicle.speed_kmh)} km/h</span>
                  </div>
                </div>

                <div className="shrink-0 text-white/30 transition-all duration-150 group-hover:translate-x-1 group-hover:text-white/70">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6 12L10 8L6 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && searchQuery && filteredVehicles.length === 0 && (
        <div className="glass-card fade-in slide-in-from-top-2 absolute top-full right-0 left-0 mt-2 animate-in overflow-hidden rounded-xl duration-200">
          <div className="px-4 py-8 text-center">
            <div className="text-white/40 text-sm font-medium">Nie znaleziono pojazdów</div>
            <div className="text-white/20 text-xs mt-1">Spróbuj wpisać numer rejestracyjny</div>
          </div>
        </div>
      )}
    </div>
  );
}
