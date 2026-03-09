"use client";

import Header from "@/components/dashboard/header";
import SearchBar from "@/components/dashboard/search";
import MapContainer from "./map-container";
import type { TruckPosition } from "@/lib/tracking-websocket-context";
import { useVehicleNavigation } from "@/lib/vehicle-navigation-context";

export default function DashboardClient() {
  const { followingVehicleId, setFollowingVehicleId, handleUnfollow } = useVehicleNavigation();

  const handleSelectVehicle = (vehicle: TruckPosition) => {
    setFollowingVehicleId(vehicle.truck_id);
  };

  return (
    <>
      <Header />
      <SearchBar onSelectVehicle={handleSelectVehicle} />
      <MapContainer
        onFollowVehicle={setFollowingVehicleId}
        followingVehicleId={followingVehicleId}
        onUnfollow={handleUnfollow}
      />
    </>
  );
}
