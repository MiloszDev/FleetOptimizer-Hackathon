"use client";

import { Menu as MenuIcon } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useWindowStore, SNAP_GAP } from "@/lib/window-store";
import { useTracking } from "@/lib/tracking-websocket-context";

const NAV_ITEMS = [
  { label: "Informacje", action: () => useWindowStore.getState().toggle("quickInfo") },
  { label: "Logi", action: () => useWindowStore.getState().toggle("logs") },
  { label: "Informacje o ciężarówkach", action: () => useWindowStore.getState().toggle("trucksInfo") }
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const setAnchorOffsets = useWindowStore((state) => state.setAnchorOffsets);
  const { speedMultiplier, setSpeedMultiplier } = useTracking();

  const updateOffsets = useCallback(() => {
    requestAnimationFrame(() => {
      const headerEl = document.getElementById("app-header");
      if (!headerEl) return;
      const headerBottom = headerEl.getBoundingClientRect().bottom;
      const baseEl = headerEl.querySelector<HTMLElement>("[data-header-base]");
      const zoomEl = document.getElementById("app-zoom");
      const zoomBottom = zoomEl ? zoomEl.getBoundingClientRect().bottom : headerBottom;
      const baseBottom = baseEl ? baseEl.getBoundingClientRect().bottom : headerBottom;
      setAnchorOffsets({
        belowHeaderLeft: headerBottom + SNAP_GAP,
        belowHeaderRight: Math.max(baseBottom, zoomBottom) + SNAP_GAP,
      });
    });
  }, [setAnchorOffsets]);

  useEffect(() => {
    updateOffsets();
    const resize = () => updateOffsets();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [updateOffsets]);

  useEffect(() => {
    updateOffsets();
  }, [isMenuOpen, updateOffsets]);

  return (
    <div id="app-header" className="absolute top-4 left-4 z-1000 w-80">
      <div className="glass-card transition-all duration-300" data-header-base>
        <div className="p-1 px-4">
          <div className="flex w-full items-center justify-between gap-8">
            <Image src="/img/logo.png" alt="logo" width={128} height={68} />
            <button
              onClick={() => {
                setIsMenuOpen((prev) => !prev);
              }}
              className="cursor-pointer rounded-full p-3 transition-all duration-200 hover:opacity-80 active:scale-[0.95] text-white"
              aria-label="Toggle menu"
            >
              <MenuIcon
                className={`h-6 w-6 transition-transform duration-300 ${isMenuOpen ? "rotate-90" : "rotate-0"}`}
              />
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="glass-card fade-in slide-in-from-top-2 mt-2 animate-in overflow-hidden duration-200">
          <nav className="py-2">
            {NAV_ITEMS.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  item.action();
                  setIsMenuOpen(false);
                  updateOffsets();
                }}
                className="block w-full whitespace-nowrap px-6 py-3 text-left text-sm text-white transition-all duration-150 hover:bg-white/15 active:bg-white/25"
              >
                {item.label}
              </button>
            ))}
            <div className="border-white/10 border-t px-6 py-4">
              <label className="mb-3 flex items-center justify-between text-sm font-medium text-white">
                <span>Prędkość symulacji</span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-blue-300">
                  {speedMultiplier}x
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="10000"
                value={speedMultiplier}
                onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
                className="h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-gradient-to-r from-white/20 to-white/10 accent-blue-500"
              />
              <div className="mt-2 flex justify-between text-white/60 text-xs font-medium">
                <span>1x</span>
                <span>5000x</span>
                <span>10000x</span>
              </div>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
