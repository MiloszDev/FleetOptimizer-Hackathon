"use client";

import { useWindowStore } from "@/lib/window-store";
import QuickInfo from "./windows/quick-info";
import LogsWindow from "./windows/logs-window";
import TrucksInfo from "./windows/trucks-info";
import FinancialStats from "./windows/financial-stats";

const WINDOW_COMPONENTS = {
  quickInfo: QuickInfo,
  logs: LogsWindow,
  trucksInfo: TrucksInfo,
  financialStats: FinancialStats,
} as const;

type WindowId = keyof typeof WINDOW_COMPONENTS;

export default function WindowManager() {
  const windows = useWindowStore((state) => state.windows);
  const openWindowIds = Object.entries(windows)
    .filter(([, isOpen]) => isOpen)
    .map(([id]) => id as WindowId);

  return (
    <>
      {openWindowIds.map((windowId) => {
        const WindowComponent = WINDOW_COMPONENTS[windowId];
        return WindowComponent ? <WindowComponent key={windowId} /> : null;
      })}
    </>
  );
}