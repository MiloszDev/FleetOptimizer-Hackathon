"use client";

import type React from 'react';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

export interface TruckPosition {
  truck_id: number;
  registration_number: string;
  brand: string;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  heading: number;
  status: string;
  current_route_index: number;
  location_sequence: number[];
  segment_progress: number;
  start_time: string;
  end_time: string;
  odometer_km: number;
}

interface SimulationTime {
  current_time: string;
  simulation_start: string;
  elapsed_days: number;
  simulation_speed: number;
  is_running: boolean;
  is_finished: boolean;
}

interface QuickStats {
  top_3_lease_ending: any[];
  top_3_service_needed: any[];
  vehicles_over_limit: number;
  total_services_needed: number;
  average_odometer: number;
  total_km_driven: number;
  vehicles_needing_replacement: number;
  average_days_to_lease_end: number;
}

interface FinancialStats {
  relocation_cost_pln: number;
  service_cost_pln: number;
  penalty_cost_pln: number;
  total_cost_pln: number;
  routes_assigned: number;
  vehicles_used: number;
  total_services: number;
  total_distance_km: number;
  data_available: boolean;
}

interface TrackingContextValue {
  positions: Map<number, TruckPosition>;
  connected: boolean;
  speedMultiplier: number;
  setSpeedMultiplier: (speed: number) => void;
  recalculateTruck: (truckId: number) => Promise<boolean>;
  onLogEvent?: (event: LogEvent) => void;
  simulationTime: SimulationTime | null;
  quickStats: QuickStats | null;
  financialStats: FinancialStats | null;
  vehicleCount: number | null;
}

export interface LogEvent {
  type: 'route_start' | 'route_complete' | 'recalculate' | 'status_change';
  truck_id: number;
  registration_number: string;
  message: string;
  timestamp: Date;
}

const TrackingContext = createContext<TrackingContextValue | null>(null);

export function TrackingWebSocketProvider({ children }: { children: React.ReactNode }) {
  const [positions, setPositions] = useState<Map<number, TruckPosition>>(new Map());
  const [connected, setConnected] = useState(false);
  const [speedMultiplier, setSpeedMultiplierState] = useState(1);
  const [simulationTime, setSimulationTime] = useState<SimulationTime | null>(null);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [financialStats, setFinancialStats] = useState<FinancialStats | null>(null);
  const [vehicleCount, setVehicleCount] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<Map<number, string>>(new Map());
  const logCallbackRef = useRef<((event: LogEvent) => void) | undefined>(undefined);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket('ws://localhost:8000/api/tracking/ws');

    ws.onopen = () => {
      setConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'initial' || data.type === 'positions_update') {
          const newPositions = new Map<number, TruckPosition>();
          
          // Update simulation time if available in WebSocket message
          if (data.stats) {
            const allFinished = data.positions.every((p: any) => p.status === 'completed');
            setSimulationTime({
              current_time: data.simulation_time,
              simulation_start: '2024-01-01T00:00:00',
              elapsed_days: data.stats.elapsed_days,
              simulation_speed: data.speed_multiplier,
              is_running: data.stats.is_running,
              is_finished: allFinished
            });
            if (data.stats.quick_stats) setQuickStats(data.stats.quick_stats);
            if (data.stats.financial_stats) setFinancialStats(data.stats.financial_stats);
            if (data.stats.vehicle_count !== undefined) setVehicleCount(data.stats.vehicle_count);
          } else if (data.simulation_time && data.speed_multiplier !== undefined) {
            setSimulationTime(prev => prev ? {
              ...prev,
              current_time: data.simulation_time,
              simulation_speed: data.speed_multiplier,
              is_finished: false
            } : null);
          }

          for (const pos of data.positions) {
            newPositions.set(pos.truck_id, pos);

            const lastStatus = lastStatusRef.current.get(pos.truck_id);
            if (lastStatus !== pos.status) {
              lastStatusRef.current.set(pos.truck_id, pos.status);

              if (pos.status === 'in_transit' && lastStatus === 'idle') {
                logCallbackRef.current?.({
                  type: 'route_start',
                  truck_id: pos.truck_id,
                  registration_number: pos.registration_number,
                  message: `ciężarówka ${pos.registration_number} rozpoczęła trasę`,
                  timestamp: new Date()
                });
              } else if (pos.status === 'completed' && lastStatus === 'in_transit') {
                logCallbackRef.current?.({
                  type: 'route_complete',
                  truck_id: pos.truck_id,
                  registration_number: pos.registration_number,
                  message: `ciężarówka ${pos.registration_number} zakończyła trasę`,
                  timestamp: new Date()
                });
              }
            }
          }

          setPositions(newPositions);

          if (data.type === 'initial' && data.speed_multiplier) {
            setSpeedMultiplierState(data.speed_multiplier);
          }
        } else if (data.type === 'recalculate_result') {
          if (data.success) {
            setPositions((currentPositions) => {
              const pos = currentPositions.get(data.truck_id);
              if (pos) {
                logCallbackRef.current?.({
                  type: 'recalculate',
                  truck_id: data.truck_id,
                  registration_number: pos.registration_number,
                  message: `przeliczono trasę dla ${pos.registration_number}`,
                  timestamp: new Date()
                });
              }
              return currentPositions;
            });
          }
        }
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const setSpeedMultiplier = useCallback((speed: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_speed', speed_multiplier: speed }));
      setSpeedMultiplierState(speed);
    }
  }, []);

  const recalculateTruck = useCallback(async (truckId: number): Promise<boolean> => new Promise((resolve) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'recalculate', truck_id: truckId }));
        setTimeout(() => resolve(true), 100);
      } else {
        resolve(false);
      }
    }), []);

  const contextValue: TrackingContextValue = {
    positions,
    connected,
    speedMultiplier,
    setSpeedMultiplier,
    recalculateTruck,
    onLogEvent: undefined,
    simulationTime,
    quickStats,
    financialStats,
    vehicleCount
  };

  return (
    <TrackingContext.Provider value={contextValue}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTracking must be used within TrackingWebSocketProvider');
  }
  return context;
}

export function useTrackingLogs(callback: (event: LogEvent) => void) {
  const context = useContext(TrackingContext);
  useEffect(() => {
    if (context) {
      (context as any).onLogEvent = callback;
      return () => {
        (context as any).onLogEvent = undefined;
      };
    }
  }, [context, callback]);
}
