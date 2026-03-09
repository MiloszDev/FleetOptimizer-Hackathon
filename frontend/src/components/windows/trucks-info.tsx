"use client";

import WindowPanel from "./window-panel";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client-client";
import { getVehiclePositionsApiSimulationVehiclesPositionsGetOptions } from "@/lib/api-client/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { useVehicleNavigation } from "@/lib/vehicle-navigation-context";

const statusVariant: Record<string, string> = {
  active: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  service: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  inspection: "border-sky-500/40 bg-sky-500/15 text-sky-200",
};

function StatusChip({ status }: { status: string }) {
  const base =
    "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium";
  return <span className={`${base} ${statusVariant[status] || statusVariant.active}`}>{status}</span>;
}

function getVehicleStatus(currentOdometer: number, serviceInterval: number): { status: string; distanceToService: string } {
  const distanceToService = serviceInterval - (currentOdometer % serviceInterval);

  if (distanceToService < 100) {
    return { status: "service", distanceToService: `${distanceToService.toFixed(0)} km` };
  }if (distanceToService < 500) {
    return { status: "inspection", distanceToService: `${distanceToService.toFixed(0)} km` };
  }

  return { status: "active", distanceToService: `${distanceToService.toFixed(0)} km` };
}

export default function TrucksInfo() {
  const { handleGoToVehicle } = useVehicleNavigation();
  const { data, isLoading } = useQuery({
    ...getVehiclePositionsApiSimulationVehiclesPositionsGetOptions({
      client: apiClient,
    }),
    refetchInterval: 10_000,
  });

  const vehicles = data?.vehicles || [];

  return (
    <WindowPanel
      id="trucksInfo"
      title="Informacje o ciężarówkach"
      defaultSize={{ width: 900, height: 380 }}
      resizable={true}
    >
      <div className="padding-3 flex h-full flex-col gap-3 p-3 text-muted-foreground text-sm">
        <header className="flex flex-col gap-1">
          <h2 className="font-semibold text-base text-foreground">Status floty</h2>
          <p>Podgląd dyspozycji, lokalizacji oraz zbliżającego się serwisu.</p>
        </header>

        {/* Scrollable table container with custom scrollbars */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-background/60 backdrop-blur supports-backdrop-filter:bg-background/40">
          <div className="custom-scrollbar h-full w-full overflow-scroll">
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur">
                <tr className="border-border/50 border-b">
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Nr rej.</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Marka</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Przebieg</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Lokalizacja</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Koordynaty</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Dystans do serwisu</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && vehicles.length === 0 && (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted-foreground" colSpan={8}>
                      Ładowanie danych...
                    </td>
                  </tr>
                )}
                {!isLoading && vehicles.length === 0 && (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted-foreground" colSpan={8}>
                      Brak danych do wyświetlenia.
                    </td>
                  </tr>
                )}
                {vehicles.map((vehicle) => {
                  const { status, distanceToService } = getVehicleStatus(
                    vehicle.current_odometer_km || 0,
                    vehicle.service_interval_km || 10_000
                  );

                  return (
                    <tr key={vehicle.id} className="border-border/40 border-b transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 text-left font-medium font-mono text-foreground">{vehicle.registration_number}</td>
                      <td className="px-4 py-3 text-left font-semibold text-foreground/90">{vehicle.brand}</td>
                      <td className="px-4 py-3 text-left">
                        <StatusChip status={status} />
                      </td>
                      <td className="px-4 py-3 text-left text-foreground/90 tabular-nums">
                        {vehicle.current_odometer_km?.toLocaleString() || 'N/A'} km
                      </td>
                      <td className="px-4 py-3 text-left text-foreground/90">{vehicle.location_name}</td>
                      <td className="px-4 py-3 text-left text-foreground/70 text-xs tabular-nums">
                        {vehicle.latitude.toFixed(4)}, {vehicle.longitude.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-left text-foreground/90 tabular-nums">{distanceToService}</td>
                      <td className="px-4 py-3 text-left">
                        <Button
                          onClick={() => handleGoToVehicle(vehicle.id)}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs hover:bg-primary/10 hover:text-primary"
                        >
                          <MapPin className="mr-1 h-3.5 w-3.5" />
                          Pokaż
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 14px;
          height: 14px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: hsl(var(--background) / 0.5);
          border-radius: 8px;
          border: 1px solid hsl(var(--border) / 0.3);
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--primary) / 0.7);
          border-radius: 8px;
          border: 2px solid hsl(var(--background));
          transition: background 0.2s;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--primary) / 0.9);
        }

        .custom-scrollbar::-webkit-scrollbar-corner {
          background: hsl(var(--background));
        }

        /* Firefox */
        .custom-scrollbar {
          scrollbar-width: auto;
          scrollbar-color: hsl(var(--primary) / 0.7) hsl(var(--background) / 0.5);
        }
      `}</style>
    </WindowPanel>
  );
}
