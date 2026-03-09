"use client";

import { useQuery } from "@tanstack/react-query";
import WindowPanel from "./window-panel";
import { useTracking } from "@/lib/tracking-websocket-context";
import { TrendingUp, TrendingDown, DollarSign, Truck, Wrench, AlertTriangle } from "lucide-react";

export default function FinancialStats() {
  const tracking = useTracking();
  const stats = tracking.financialStats;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pl-PL').format(value);
  };

  return (
    <WindowPanel
      id="financialStats"
      title="Statystyki Finansowe"
      defaultSize={{ width: 600, height: 450 }}
      resizable={true}
    >
      <div className="flex h-full flex-col gap-4 p-4">
        {!stats ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">Łączenie z serwerem...</p>
          </div>
        ) : (
          <>
            {!stats.data_available && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <p className="font-medium text-amber-200">Brak danych symulacji</p>
                </div>
                <p className="mt-2 text-amber-300/80 text-sm">
                  Uruchom symulację optymalizacji floty, aby wygenerować statystyki finansowe.
                </p>
              </div>
            )}

            {/* Total Cost - Main Display */}
            <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                    Całkowity Koszt
                  </p>
                  <p className="mt-2 font-bold text-3xl text-foreground">
                    {formatCurrency(stats.total_cost_pln)}
                  </p>
                </div>
                <div className="rounded-full bg-primary/20 p-3">
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-400" />
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Relokacje
                  </p>
                </div>
                <p className="mt-2 font-bold text-foreground text-lg">
                  {formatCurrency(stats.relocation_cost_pln)}
                </p>
                <p className="mt-1 text-muted-foreground text-xs">
                  1000 + 1/km + 150/h
                </p>
              </div>

              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-emerald-400" />
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Serwisy
                  </p>
                </div>
                <p className="mt-2 font-bold text-foreground text-lg">
                  {formatCurrency(stats.service_cost_pln)}
                </p>
         
              </div>

              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Kary
                  </p>
                </div>
                <p className="mt-2 font-bold text-foreground text-lg">
                  {formatCurrency(stats.penalty_cost_pln)}
                </p>
                <p className="mt-1 text-muted-foreground text-xs">
                  0.92 PLN / km ponad limit
                </p>
              </div>
            </div>

            {/* Operational Statistics */}
            <div className="rounded-lg border border-border/60 bg-background/40 p-4">
              <p className="mb-3 font-semibold text-foreground text-sm uppercase tracking-wide">
                Statystyki Operacyjne
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs">Przypisane trasy</p>
                  <p className="mt-1 font-bold text-foreground text-xl">
                    {formatNumber(stats.routes_assigned)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Wykorzystane pojazdy</p>
                  <p className="mt-1 font-bold text-foreground text-xl">
                    {formatNumber(stats.vehicles_used)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Wykonane serwisy</p>
                  <p className="mt-1 font-bold text-foreground text-xl">
                    {formatNumber(stats.total_services)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Przejechane km</p>
                  <p className="mt-1 font-bold text-foreground text-xl">
                    {formatNumber(Math.round(stats.total_distance_km))}
                  </p>
                </div>
              </div>
            </div>

            {/* Cost Distribution Chart (Simple text-based) */}
            <div className="rounded-lg border border-border/60 bg-background/40 p-4">
              <p className="mb-3 font-semibold text-foreground text-sm uppercase tracking-wide">
                Rozkład Kosztów
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Relokacje', value: stats.relocation_cost_pln, color: 'bg-blue-500' },
                  { label: 'Serwisy', value: stats.service_cost_pln, color: 'bg-emerald-500' },
                  { label: 'Kary', value: stats.penalty_cost_pln, color: 'bg-amber-500' },
                ].map(({ label, value, color }) => {
                  const percentage = stats.total_cost_pln > 0 
                    ? (value / stats.total_cost_pln) * 100 
                    : 0;
                  return (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium text-foreground">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-border/30">
                        <div 
                          className={`h-full ${color} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </WindowPanel>
  );
}

