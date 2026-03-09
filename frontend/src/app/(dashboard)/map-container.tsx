"use client";

import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/components/dashboard/map"), { ssr:false })

interface MapContainerProps {
  onFollowVehicle?: (vehicleId: number) => void;
  followingVehicleId?: number | null;
  onUnfollow?: () => void;
}

export default function MapContainer({ onFollowVehicle, followingVehicleId, onUnfollow }: MapContainerProps){

    return (
        <div className="fixed inset-0 z-0 h-screen w-full bg-background">
            <Map onFollowVehicle={onFollowVehicle} followingVehicleId={followingVehicleId} onUnfollow={onUnfollow} />
        </div>
    );
}