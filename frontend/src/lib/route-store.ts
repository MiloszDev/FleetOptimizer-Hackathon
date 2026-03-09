import { create } from 'zustand';
import type { RouteAnimationControls } from '@/components/route_player/route';

interface RouteStore {
  controls: RouteAnimationControls | null;
  setControls: (controls: RouteAnimationControls | null) => void;
  startRoute: () => void;
}

export const useRouteStore = create<RouteStore>((set, get) => ({
  controls: null,
  setControls: (controls) => set({ controls }),
  startRoute: () => {
    const { controls } = get();
    if (controls) {
      controls.stop();
      controls.start();
    }
  },
}));
