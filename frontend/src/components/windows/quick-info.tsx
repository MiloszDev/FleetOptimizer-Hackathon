"use client";

import { useEffect, useState } from "react";
import WindowPanel from "./window-panel";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client-client";
import { 
  getVehicleCountApiVehiclesCountGetOptions,
  getQuickStatsApiVehiclesQuickStatsGetOptions,
  getSimulationTimeApiSimulationTimeGetOptions 
} from "@/lib/api-client/@tanstack/react-query.gen";
import { useTracking } from "@/lib/tracking-websocket-context";

export default function QuickInfo() {
  const tracking = useTracking();
  
  const displaySimTime = tracking.simulationTime;
  const displayStats = tracking.quickStats;
  const displayCount = tracking.vehicleCount;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pl-PL').format(Math.round(value));
  };

  return (
    <WindowPanel
      id="quickInfo"
      title="Informacje"
      defaultSize={{ width: 520, height: 580 }}
      resizable={true}
    >
      <div className="flex flex-1 flex-col gap-3 p-4 text-sm">
        {displaySimTime && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Czas symulacji</p>
            <p className="mt-1 text-foreground">
              {formatDate(displaySimTime.current_time)}
            </p>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Dni: <span className="font-semibold text-foreground">{displaySimTime.elapsed_days}</span>
              </span>
              {displaySimTime.is_finished ? (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300">
                  KONIEC SYMULACJI
                </span>
              ) : (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  displaySimTime.is_running 
                    ? 'bg-emerald-500/20 text-emerald-300' 
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {displaySimTime.is_running ? 'Aktywna' : 'Zatrzymana'}
                </span>
              )}
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
              Prędkość: {Math.round(displaySimTime.simulation_speed || 1)}x
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Flota</p>
          <p className="text-foreground">
            Liczba pojazdów: <span className="font-semibold">{displayCount ?? "..."}</span>
          </p>
        </div>

        {displayStats && (
          <>
        <div className="space-y-2">
          <p className="font-semibold text-foreground text-xs uppercase tracking-wide">TOP 3 najbliżej końca leasingu</p>
          {displayStats.top_3_lease_ending && displayStats.top_3_lease_ending.length > 0 ? (
            <div className="space-y-1">
              {displayStats.top_3_lease_ending.map((vehicle, idx) => (
                <div key={vehicle.id} className="rounded border border-border/50 bg-background/40 p-2">
                  <p className="font-medium font-mono text-foreground text-xs">
                    {idx + 1}. {vehicle.registration_number} ({vehicle.brand})
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Koniec: {formatDate(vehicle.leasing_end_date)} ({vehicle.days_remaining} dni)
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">Brak danych</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-foreground text-xs uppercase tracking-wide">TOP 3 najbliżej serwisu</p>
          {displayStats.top_3_service_needed && displayStats.top_3_service_needed.length > 0 ? (
            <div className="space-y-1">
              {displayStats.top_3_service_needed.map((vehicle, idx) => (
                <div key={vehicle.id} className="rounded border border-border/50 bg-background/40 p-2">
                  <p className="font-medium font-mono text-foreground text-xs">
                    {idx + 1}. {vehicle.registration_number} ({vehicle.brand})
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {vehicle.km_until_service} km do serwisu
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">Brak danych</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Statystyki</p>
          <div className="space-y-1">
            <p className="text-foreground text-xs">
              Pojazdy ponad limit: <span className="font-semibold">{displayStats.vehicles_over_limit ?? 0}</span>
            </p>
            <p className="text-foreground text-xs">
              Wymagane serwisy ({"<"}500km): <span className="font-semibold">{displayStats.total_services_needed ?? 0}</span>
            </p>
            <p className="text-foreground text-xs">
              Pojazdy do wymiany: <span className="font-semibold text-amber-400">{displayStats.vehicles_needing_replacement ?? 0}</span>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Analityka</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-border/50 bg-background/40 p-2">
              <p className="text-muted-foreground text-xs">Średni przebieg</p>
              <p className="mt-1 font-bold text-foreground text-sm">
                {formatNumber(displayStats.average_odometer ?? 0)} km
              </p>
            </div>
            <div className="rounded border border-border/50 bg-background/40 p-2">
              <p className="text-muted-foreground text-xs">Całkowity przebieg</p>
              <p className="mt-1 font-bold text-foreground text-sm">
                {formatNumber(displayStats.total_km_driven ?? 0)} km
              </p>
            </div>
            <div className="rounded border border-border/50 bg-background/40 p-2">
              <p className="text-muted-foreground text-xs">Śr. dni do końca leasingu</p>
              <p className="mt-1 font-bold text-foreground text-sm">
                {formatNumber(displayStats.average_days_to_lease_end ?? 0)} dni
              </p>
            </div>
            <div className="rounded border border-border/50 bg-background/40 p-2">
              <p className="text-muted-foreground text-xs">Pojazdy aktywne</p>
              <p className="mt-1 font-bold text-emerald-400 text-sm">
                {displayCount ?? 0}
              </p>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </WindowPanel>
  );
}
