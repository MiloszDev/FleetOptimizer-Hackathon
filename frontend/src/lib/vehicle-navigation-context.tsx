"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface VehicleNavigationContextType {
  followingVehicleId: number | null;
  setFollowingVehicleId: (id: number | null) => void;
  handleGoToVehicle: (vehicleId: number) => void;
  handleUnfollow: () => void;
}

// Create context with a default value to avoid errors during SSR/hydration
const VehicleNavigationContext = createContext<VehicleNavigationContextType>({
  followingVehicleId: null,
  setFollowingVehicleId: () => {},
  handleGoToVehicle: () => {},
  handleUnfollow: () => {},
});

export function VehicleNavigationProvider({ children }: { children: ReactNode }) {
  const [followingVehicleId, setFollowingVehicleId] = useState<number | null>(null);

  const handleGoToVehicle = (vehicleId: number) => {
    console.log("VehicleNavigation: Going to vehicle", vehicleId);
    setFollowingVehicleId(vehicleId);
  };

  const handleUnfollow = () => {
    console.log("VehicleNavigation: Unfollowing");
    setFollowingVehicleId(null);
  };

  return (
    <VehicleNavigationContext.Provider
      value={{
        followingVehicleId,
        setFollowingVehicleId,
        handleGoToVehicle,
        handleUnfollow,
      }}
    >
      {children}
    </VehicleNavigationContext.Provider>
  );
}

export function useVehicleNavigation() {
  return useContext(VehicleNavigationContext);
}

