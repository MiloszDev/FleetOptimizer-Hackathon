import { create } from 'zustand'

export type SnapAnchor = 'belowHeaderLeft' | 'belowHeaderRight'

type Size = { width: number; height: number }
type Position = { x: number; y: number }

type SnapMap = Record<SnapAnchor, string[]>

type StoreSlice = {
  windows: Record<string, boolean>
  positions: Record<string, Position>
  snaps: SnapMap
  sizes: Record<string, Size>
  anchorOffsets: Record<SnapAnchor, number>
  lastSnaps: Record<string, { anchor: SnapAnchor }>
}

interface WindowState extends StoreSlice {
  toggle: (id: string) => void
  open: (id: string) => void
  close: (id: string) => void
  setPosition: (id: string, pos: Position) => void
  setSize: (id: string, size: Size) => void
  setAnchorOffsets: (offsets: Partial<Record<SnapAnchor, number>>) => void
  snapWindow: (id: string, anchor: SnapAnchor, size: Size, stackTop: number, gap?: number) => void
  unsnapWindow: (id: string) => void
}

export const SNAP_GAP = 12
const DEFAULT_SIZE: Size = { width: 320, height: 400 }
const VIEWPORT_FALLBACK = 1920

const getViewportWidth = () => (typeof window !== 'undefined' ? window.innerWidth : VIEWPORT_FALLBACK)

const computeAnchorX = (anchor: SnapAnchor, width: number) =>
  anchor === 'belowHeaderLeft' ? 16 : Math.max(16, getViewportWidth() - width - 16)

const anchors: SnapAnchor[] = ['belowHeaderLeft', 'belowHeaderRight']

const findAnchorForWindow = (snaps: SnapMap, id: string): SnapAnchor | null => {
  for (const anchor of anchors) {
    if (snaps[anchor].includes(id)) return anchor
  }
  return null
}

const reflowAnchor = (
  anchor: SnapAnchor,
  snaps: SnapMap,
  sizes: Record<string, Size>,
  windows: Record<string, boolean>,
  base: number,
  gap: number,
): Record<string, Position> => {
  let cursorY = base
  const positions: Record<string, Position> = {}
  for (const id of snaps[anchor]) {
    if (!windows[id]) continue
    const size = sizes[id] ?? DEFAULT_SIZE
    positions[id] = {
      x: computeAnchorX(anchor, size.width),
      y: cursorY,
    }
    cursorY += size.height + gap
  }
  return positions
}

const removeFromSnaps = (
  id: string,
  snaps: SnapMap,
  windows: Record<string, boolean>,
  sizes: Record<string, Size>,
  anchorOffsets: Record<SnapAnchor, number>,
) => {
  let changed = false
  const nextSnaps: SnapMap = {
    belowHeaderLeft: [],
    belowHeaderRight: [],
  }
  for (const anchor of anchors) {
    nextSnaps[anchor] = snaps[anchor].filter((wid) => {
      if (wid === id) changed = true
      return wid !== id
    })
  }
  const positions: Record<string, Position> = {}
  if (changed) {
    for (const anchor of anchors) {
      const base = anchorOffsets[anchor] ?? 16
      Object.assign(positions, reflowAnchor(anchor, nextSnaps, sizes, windows, base, SNAP_GAP))
    }
  }
  return { changed, snaps: nextSnaps, positions }
}

const buildClosedState = (state: WindowState, id: string) => {
  if (!state.windows[id]) return null
  const windows = { ...state.windows, [id]: false }
  const anchor = findAnchorForWindow(state.snaps, id)
  const lastSnaps = anchor ? { ...state.lastSnaps, [id]: { anchor } } : state.lastSnaps
  const { changed, snaps, positions } = removeFromSnaps(id, state.snaps, windows, state.sizes, state.anchorOffsets)
  if (!changed) {
    const result: Partial<WindowState> = {
      windows,
    }
    if (lastSnaps !== state.lastSnaps) {
      result.lastSnaps = lastSnaps
    }
    return result
  }
  const mergedPositions = { ...state.positions }
  delete mergedPositions[id]
  Object.assign(mergedPositions, positions)
  const result: Partial<WindowState> = {
    windows,
    snaps,
    positions: mergedPositions,
  }
  if (lastSnaps !== state.lastSnaps) {
    result.lastSnaps = lastSnaps
  }
  return result
}

const buildOpenState = (state: WindowState, id: string) => {
  if (state.windows[id]) return {}
  const windows = { ...state.windows, [id]: true }
  const last = state.lastSnaps[id]
  if (!last) {
    return { windows }
  }
  const size = state.sizes[id] ?? DEFAULT_SIZE
  const snaps: SnapMap = {
    belowHeaderLeft: state.snaps.belowHeaderLeft.filter((w) => w !== id),
    belowHeaderRight: state.snaps.belowHeaderRight.filter((w) => w !== id),
  }
  snaps[last.anchor] = [...snaps[last.anchor], id]
  const sizes = { ...state.sizes, [id]: size }
  const anchorOffsets = { ...state.anchorOffsets }
  const positions = { ...state.positions }
  for (const anchor of anchors) {
    const base = anchorOffsets[anchor] ?? 16
    Object.assign(positions, reflowAnchor(anchor, snaps, sizes, windows, base, SNAP_GAP))
  }
  return {
    windows,
    snaps,
    sizes,
    positions,
    anchorOffsets,
  }
}

export const useWindowStore = create<WindowState>((set) => ({
  windows: {
    quickInfo: true,
    logs: false,
  },
  positions: {
    quickInfo: { x: 20, y: 100 },
    logs: { x: 400, y: 150 },
  },
  snaps: { belowHeaderLeft: [], belowHeaderRight: [] },
  sizes: {},
  anchorOffsets: { belowHeaderLeft: 16, belowHeaderRight: 16 },
  lastSnaps: {},
  toggle: (id) =>
    set((state) => {
      if (state.windows[id]) {
        const next = buildClosedState(state, id)
        return next ?? {}
      }
      return buildOpenState(state, id)
    }),
  open: (id) => set((state) => buildOpenState(state, id)),
  close: (id) =>
    set((state) => {
      const next = buildClosedState(state, id)
      return next ?? {}
    }),
  setPosition: (id, pos) =>
    set((state) => ({
      positions: { ...state.positions, [id]: pos },
    })),
  setSize: (id, size) =>
    set((state) => ({
      sizes: { ...state.sizes, [id]: size },
    })),
  setAnchorOffsets: (offsets) =>
    set((state) => {
      let changed = false
      const anchorOffsets = { ...state.anchorOffsets }
      const positions = { ...state.positions }
      for (const anchor of anchors) {
        const value = offsets[anchor]
        if (value == null || anchorOffsets[anchor] === value) continue
        changed = true
        anchorOffsets[anchor] = value
        Object.assign(positions, reflowAnchor(anchor, state.snaps, state.sizes, state.windows, value, SNAP_GAP))
      }
      if (!changed) return {}
      return {
        anchorOffsets,
        positions,
      }
    }),
  snapWindow: (id, anchor, size, stackTop, gap = SNAP_GAP) =>
    set((state) => {
      const snaps: SnapMap = {
        belowHeaderLeft: state.snaps.belowHeaderLeft.filter((w) => w !== id),
        belowHeaderRight: state.snaps.belowHeaderRight.filter((w) => w !== id),
      }
      snaps[anchor] = [...snaps[anchor], id]
      const sizes = { ...state.sizes, [id]: size }
      const windows = { ...state.windows, [id]: true }
      const anchorOffsets = { ...state.anchorOffsets, [anchor]: stackTop }
      const positions = { ...state.positions }
      for (const current of anchors) {
        const base = anchorOffsets[current] ?? 16
        Object.assign(positions, reflowAnchor(current, snaps, sizes, windows, base, gap))
      }
      const lastSnaps = { ...state.lastSnaps, [id]: { anchor } }
      return {
        snaps,
        sizes,
        windows,
        positions,
        anchorOffsets,
        lastSnaps,
      }
    }),
  unsnapWindow: (id) =>
    set((state) => {
      const { changed, snaps, positions } = removeFromSnaps(
        id,
        state.snaps,
        state.windows,
        state.sizes,
        state.anchorOffsets,
      )
      const hadMemory = state.lastSnaps[id] !== undefined
      const nextLastSnaps = hadMemory ? { ...state.lastSnaps } : state.lastSnaps
      if (hadMemory) {
        delete nextLastSnaps[id]
      }
      if (!changed) {
        if (hadMemory) {
          return {
            lastSnaps: nextLastSnaps,
          }
        }
        return {}
      }
      const mergedPositions = { ...state.positions }
      const currentPosition = mergedPositions[id]
      Object.assign(mergedPositions, positions)
      if (currentPosition) {
        mergedPositions[id] = currentPosition
      }
      return {
        snaps,
        positions: mergedPositions,
        lastSnaps: hadMemory ? nextLastSnaps : state.lastSnaps,
      }
    }),
}))
