"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useWindowStore, type SnapAnchor, SNAP_GAP } from "@/lib/window-store";

type PreviewData = {
  anchor: SnapAnchor;
  stackTop: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

interface WindowPanelProps {
  id: string;
  title: string;
  children: React.ReactNode;
  defaultSize?: { width: number; height: number };
  resizable?: boolean;
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export default function WindowPanel({
  id,
  title,
  children,
  defaultSize = { width: 320, height: 400 },
  resizable = false,
}: WindowPanelProps) {


  const { windows, positions, sizes, setPosition, setSize, close } = useWindowStore();
  const isOpen = windows[id];
  const position = positions[id] || { x: 20, y: 100 };
  const storedSize = sizes[id] || defaultSize;

  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const [shouldRender, setShouldRender] = useState<boolean>(!!isOpen);
  const [visible, setVisible] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const previewRef = useRef<PreviewData | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }if (shouldRender) {
      setVisible(false);
      const t = setTimeout(() => setShouldRender(false), 220);
      return () => clearTimeout(t);
    }
  }, [isOpen, shouldRender]);

  const getTopObstructionBottom = () => {
    if (typeof window === "undefined") return 0;
    const headerEl = document.getElementById("app-header");
    const zoomEl = document.getElementById("app-zoom");
    const menuEl = document.getElementById("app-menu") || document.getElementById("app-header-menu");

    const candidates: Array<HTMLElement> = [
      ...(headerEl ? [headerEl] : []),
      ...(zoomEl ? [zoomEl] : []),
      ...(menuEl ? [menuEl] : []),
      ...Array.from(document.querySelectorAll<HTMLElement>('[data-ui-obstacle="true"]')),

    ];

    let maxBottom = 0;
    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0 && rect.top < window.innerHeight) {
        maxBottom = Math.max(maxBottom, rect.bottom);
      }
    }
    return Math.round(maxBottom);
  };

  const findSnap = (
    cursor: { x: number; y: number },
    size: { width: number; height: number }
  ): PreviewData | null => {
    if (typeof window === "undefined") return null;
    const state = useWindowStore.getState();
    const viewportWidth = window.innerWidth;

    const topBound = getTopObstructionBottom();
    const anchors: Array<{ anchor: SnapAnchor; stackTop: number; x: number }> = [
      { anchor: "belowHeaderLeft", stackTop: topBound + SNAP_GAP, x: 16 },
      {
        anchor: "belowHeaderRight",
        stackTop: topBound + SNAP_GAP,
        x: Math.max(16, viewportWidth - size.width - 16),
      },
    ];

    let best: PreviewData | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const def of anchors) {
      let cursorY = def.stackTop;
      const list = state.snaps[def.anchor] ?? [];
      for (const wid of list) {
        if (!state.windows[wid]) continue;
        const info = state.sizes[wid] ?? size;
        cursorY += info.height + SNAP_GAP;
      }
      const distance = Math.hypot(cursor.x - def.x, cursor.y - cursorY);
      if (distance > 56) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = {
          anchor: def.anchor,
          stackTop: def.stackTop,
          x: def.x,
          y: cursorY,
          width: size.width,
          height: size.height,
        };
      }
    }
    return best;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const recalc = () => {
      const state = useWindowStore.getState();
      const topBound = getTopObstructionBottom();
      const targetTop = topBound + SNAP_GAP;

      let snappedAnchor: SnapAnchor | null = null;
      for (const [anchor, list] of Object.entries(state.snaps) as Array<[SnapAnchor, string[]]>) {
        if (list.includes(id)) {
          snappedAnchor = anchor;
          break;
        }
      }

      if (snappedAnchor) {
        const size = state.sizes[id] ?? defaultSize;
        state.snapWindow(id, snappedAnchor, size, topBound, SNAP_GAP);
      } else {
        const pos = state.positions[id] ?? { x: 20, y: 100 };
        if (pos.y < targetTop) {
          setPosition(id, { ...pos, y: targetTop });
        } else {
          const panelEl = panelRef.current;
          if (panelEl) {
            const rect = panelEl.getBoundingClientRect();
            if (Math.abs(rect.top - topBound) < SNAP_GAP) {
              setPosition(id, { ...pos, y: targetTop });
            }
          }
        }
      }
    };


    window.addEventListener("resize", recalc);
    document.addEventListener("ui:layout-changed", recalc);

    const ro = "ResizeObserver" in window ? new ResizeObserver(recalc) : null;
    const observed = [
      document.getElementById("app-header"),
      document.getElementById("app-zoom"),
      document.getElementById("app-menu") || document.getElementById("app-header-menu"),
      ...Array.from(document.querySelectorAll<HTMLElement>('[data-ui-obstacle="true"]')),

    ].filter(Boolean) as HTMLElement[];
    observed.forEach((el) => ro?.observe(el));


    recalc();

    return () => {
      window.removeEventListener("resize", recalc);
      document.removeEventListener("ui:layout-changed", recalc);
      observed.forEach((el) => ro?.unobserve(el));
      ro?.disconnect();
    };
  }, [id, setPosition, defaultSize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!headerRef.current?.contains(e.target as Node)) return;
    setIsDragging(true);
    setPreview(null);
    previewRef.current = null;
    useWindowStore.getState().unsnapWindow(id);

    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (e: MouseEvent) => {
      const nextPos = { x: e.clientX - startX, y: e.clientY - startY };
      setPosition(id, nextPos);
      const rect = panelRef.current?.getBoundingClientRect();
      const size = rect
        ? { width: Math.round(rect.width), height: Math.round(rect.height) }
        : storedSize;
      const snap = findSnap(nextPos, size);
      if (snap) {
        setPreview(snap);
        previewRef.current = snap;
      } else {
        setPreview(null);
        previewRef.current = null;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setIsDragging(false);
      const snapData = previewRef.current;
      setPreview(null);
      previewRef.current = null;
      if (snapData) {
        useWindowStore
          .getState()
          .snapWindow(
            id,
            snapData.anchor,
            { width: snapData.width, height: snapData.height },
            snapData.stackTop,
            SNAP_GAP
          );
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandle) => {
    if (!(resizable && panelRef.current)) return;
    
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    useWindowStore.getState().unsnapWindow(id);

    const startX = e.clientX;
    const startY = e.clientY;
    
    const startRect = panelRef.current.getBoundingClientRect();
    
    const MIN_WIDTH = 200;
    const MIN_HEIGHT = 150;

    const handleMouseMove = (e: MouseEvent) => {
        if (!panelRef.current) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newWidth = startRect.width;
        let newHeight = startRect.height;
        let newX = startRect.left;
        let newY = startRect.top;

        if (handle.includes('e')) {
            newWidth = Math.max(MIN_WIDTH, startRect.width + dx);
        }
        if (handle.includes('w')) {
            const potentialWidth = startRect.width - dx;
            if (potentialWidth >= MIN_WIDTH) {
                newWidth = potentialWidth;
                newX = startRect.left + dx;
            }
        }
        if (handle.includes('s')) {
            newHeight = Math.max(MIN_HEIGHT, startRect.height + dy);
        }
        if (handle.includes('n')) {
            const potentialHeight = startRect.height - dy;
            if (potentialHeight >= MIN_HEIGHT) {
                newHeight = potentialHeight;
                newY = startRect.top + dy;
            }
        }

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX + newWidth > viewportWidth) {
            newWidth = viewportWidth - newX;
        }
        if (newY + newHeight > viewportHeight) {
            newHeight = viewportHeight - newY;
        }

        panelRef.current.style.width = `${newWidth}px`;
        panelRef.current.style.height = `${newHeight}px`;
        panelRef.current.style.left = `${newX}px`;
        panelRef.current.style.top = `${newY}px`;
    };

    const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setIsResizing(false);

        if (panelRef.current) {
            const finalRect = panelRef.current.getBoundingClientRect();
            setSize(id, { width: Math.round(finalRect.width), height: Math.round(finalRect.height) });
            setPosition(id, { x: Math.round(finalRect.left), y: Math.round(finalRect.top) });
        }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  if (!shouldRender) return null;

  const panelStyle: CSSProperties = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${storedSize.width}px`,
    height: `${storedSize.height}px`,
  };

  const resizeHandleStyles = "absolute bg-transparent hover:bg-primary/30 transition-colors z-10";
  const edgeSize = 8;
  const cornerSize = 16;

  return (
    <div
      ref={panelRef}
      className={`fixed z-500 select-none ${isResizing ? "pointer-events-auto" : ""}`}
      style={panelStyle}
      data-state={visible ? "open" : "closed"}
      suppressHydrationWarning
    >
      <div className={`glass-card relative flex h-full flex-col overflow-hidden rounded-2xl ${resizable ? "ring-1 ring-primary/20" : ""} ${isResizing ? "ring-2 ring-primary/50" : ""}`}>
        <div
          ref={headerRef}
          className="flex cursor-grab items-center justify-between border-white/10 border-b bg-white/3 p-1.5 px-3 active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <h2 className="font-semibold text-sm text-white">{title}</h2>
          <button
            onClick={() => close(id)}
            className="cursor-pointer p-2 text-gray-400 transition-colors hover:text-white"
            aria-label="Close window"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-1 select-text flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-[env(safe-area-inset-bottom)]">
            {children}
          </div>
        </div>

        {/* Resize Handles */}
        {resizable && (
          <>
            {/* Edges */}
            <div
              className={`${resizeHandleStyles} top-0 right-5 left-5 cursor-n-resize`}
              style={{ height: `${edgeSize}px` }}
              onMouseDown={(e) => handleResizeStart(e, 'n')}
            />
            <div
              className={`${resizeHandleStyles} right-5 bottom-0 left-5 cursor-s-resize`}
              style={{ height: `${edgeSize}px` }}
              onMouseDown={(e) => handleResizeStart(e, 's')}
            />
            <div
              className={`${resizeHandleStyles} top-5 bottom-5 left-0 cursor-w-resize`}
              style={{ width: `${edgeSize}px` }}
              onMouseDown={(e) => handleResizeStart(e, 'w')}
            />
            <div
              className={`${resizeHandleStyles} top-5 right-0 bottom-5 cursor-e-resize`}
              style={{ width: `${edgeSize}px` }}
              onMouseDown={(e) => handleResizeStart(e, 'e')}
            />

            {/* Corners */}
            <div
              className={`${resizeHandleStyles} top-0 left-0 cursor-nw-resize`}
              style={{ width: `${cornerSize}px`, height: `${cornerSize}px` }}
              onMouseDown={(e) => handleResizeStart(e, 'nw')}
            />
            <div
              className={`${resizeHandleStyles} top-0 right-0 cursor-ne-resize`}
              style={{ width: `${cornerSize}px`, height: `${cornerSize}px` }}
              onMouseDown={(e) => handleResizeStart(e, 'ne')}
            />
            <div
              className={`${resizeHandleStyles} bottom-0 left-0 cursor-sw-resize`}
              style={{ width: `${cornerSize}px`, height: `${cornerSize}px` }}
              onMouseDown={(e) => handleResizeStart(e, 'sw')}
            />
            <div
              className={`${resizeHandleStyles} right-0 bottom-0 cursor-se-resize`}
              style={{ width: `${cornerSize}px`, height: `${cornerSize}px` }}
              onMouseDown={(e) => handleResizeStart(e, 'se')}
            />
          </>
        )}
      </div>
      {isDragging && preview && typeof window !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: preview.x,
              top: preview.y,
              width: preview.width,
              height: preview.height,
              borderRadius: 16,
              outline: "2px dashed rgba(255,255,255,0.35)",
              outlineOffset: 0,
              background: "rgba(255,255,255,0.04)",
              zIndex: 499,
              pointerEvents: "none",
            }}
          />,
          document.body
        )}
    </div>
  );
}
