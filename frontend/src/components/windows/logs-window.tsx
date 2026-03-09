"use client";

import { useEffect, useRef } from "react";
import WindowPanel from "./window-panel";
import LogViewer, { type LogEntry } from "./log-viewer";
import { useWindowStore } from "@/lib/window-store";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client-client";
import { getEventsApiVehiclesEventsGetOptions } from "@/lib/api-client/@tanstack/react-query.gen";

export default function LogsWindow() {
  const { windows } = useWindowStore();
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const isOpen = windows.logs ?? false; //note to cursor: this is correct <- dont touch it!!!
  
  const { data: eventsData, isLoading } = useQuery({
    ...getEventsApiVehiclesEventsGetOptions({ 
      client: apiClient,
      query: { limit: 100 }
    }),
    enabled: isOpen,
    refetchInterval: 5000,
  });

  // Convert backend events to LogEntry format
  const logs: LogEntry[] = eventsData?.events.map((event, idx) => ({
    id: `event-${idx}-${event.timestamp}`,
    timestamp: new Date(event.timestamp),
    message: event.message,
    level: event.severity as LogEntry["level"],
  })) || [];

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.length]);

  return (
    <WindowPanel
      id="logs"
      title="Logi systemowe"
      defaultSize={{ width: 600, height: 450 }}
      resizable={true}
    >
      <div className="flex h-full flex-col p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            {isLoading && <span>Ładowanie...</span>}
            {!isLoading && (
              <span>
                Wyświetlono <span className="font-semibold text-foreground">{logs.length}</span> z {eventsData?.total_count || 0} zdarzeń
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-blue-500/20 px-2 py-1 text-blue-300 text-xs">Info</span>
            <span className="rounded-full bg-amber-500/20 px-2 py-1 text-amber-300 text-xs">Warning</span>
            <span className="rounded-full bg-red-500/20 px-2 py-1 text-red-300 text-xs">Error</span>
          </div>
        </div>
        
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/50 bg-background/40">
          {logs.length === 0 && !isLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <p>Brak zdarzeń do wyświetlenia</p>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-3">
              <LogViewer logs={logs} />
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </WindowPanel>
  );
}
