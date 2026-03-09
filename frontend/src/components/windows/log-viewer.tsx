"use client";

import { useEffect, useRef } from "react";

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  level: "info" | "warning" | "error" | "success";
}

interface LogViewerProps {
  logs: LogEntry[];
  maxLogs?: number;
}

const LOG_COLORS = {
  info: "text-blue-400",
  warning: "text-yellow-400",
  error: "text-red-400",
  success: "text-green-400",
};

export default function LogViewer({ logs, maxLogs = 100 }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayLogs = logs.slice(-maxLogs);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4 font-mono text-xs">
      {displayLogs.length === 0 ? (
        <div className="py-8 text-center text-gray-500">Brak wpisów...</div>
      ) : (
        displayLogs.map((log) => (
          <div key={log.id} className="flex gap-2 rounded px-2 py-1 text-gray-300 transition-colors hover:bg-white/5">
            <span className="min-w-[90px] shrink-0 text-gray-600">{formatTime(log.timestamp)}</span>
            <span className={`w-16 shrink-0 ${LOG_COLORS[log.level]}`}>[{log.level.toUpperCase()}]</span>
            <span className="wrap-break-word flex-1 text-gray-300">{log.message}</span>
          </div>
        ))
      )}
    </div>
  );
}
