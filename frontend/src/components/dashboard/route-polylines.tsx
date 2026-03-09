"use client";

import { Polyline } from 'react-leaflet';
import { useTracking } from '@/lib/tracking-websocket-context';

export default function RoutePolylines() {
  const { positions } = useTracking();

  const trucks = Array.from(positions.values());

  return (
    <>
      {trucks.map((truck) => {
        if (!truck.location_sequence || truck.location_sequence.length < 2 || truck.status !== 'in_transit') {
          return null;
        }

        return (
          <div key={truck.truck_id}>
            <Polyline
              positions={[[truck.latitude, truck.longitude]]}
              pathOptions={{ color: '#5ab2ff', weight: 4, opacity: 0.9 }}
            />
          </div>
        );
      })}
    </>
  );
}
