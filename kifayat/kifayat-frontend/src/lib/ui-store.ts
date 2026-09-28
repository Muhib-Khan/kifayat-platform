import { useSyncExternalStore } from "react";

let drawerOpen = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const uiStore = {
  isDrawerOpen: () => drawerOpen,
  toggleDrawer: () => {
    drawerOpen = !drawerOpen;
    emit();
  },
  setDrawer: (v: boolean) => {
    if (drawerOpen === v) return;
    drawerOpen = v;
    emit();
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useDrawerOpen() {
  return useSyncExternalStore(
    uiStore.subscribe,
    uiStore.isDrawerOpen,
    () => false,
  );
}
