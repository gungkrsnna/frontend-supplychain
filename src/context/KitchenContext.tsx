// src/contexts/KitchenContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type TargetsPayload = {
  meta?: { target_date?: string; note?: string; status?: string };
  products?: { productName: string; totals: Record<string, number>; grandTotal?: number }[];
  summaryPerLocation?: Record<string, number>;
  materials?: any;
};

export type DoughStageRow = {
  productName: string;
  target: number;
  produced: number;
  note?: string;
};

export type RollingRow = {
  productName: string;
  target: number;
  starterNeeded: number;
  starterProduced: number;
  fillingNeeded: number;
  fillingProduced: number;
  rolledProduced: number;
};

export type OvenRow = {
  productName: string;
  toOven: number;
  outOfOven: number;
  reject?: number;
};

export type ToppingRow = {
  productName: string;
  sfgTopping: number;
  fgTopping: number;
};

export type KitchenState = {
  targets: TargetsPayload | null;
  locations: string[];
  activeLocation: string | null;
  dough: Record<string, DoughStageRow[]>;
  rolling: Record<string, RollingRow[]>;
  oven: Record<string, OvenRow[]>;
  topping: Record<string, ToppingRow[]>;
  completedLocations: Record<string, boolean>;
  lastUpdatedAt?: string | null;
};

type KitchenContextValue = {
  state: KitchenState;
  setState: (updater: Partial<KitchenState> | ((s: KitchenState) => KitchenState)) => void;
  setTargets: (payload: TargetsPayload | null) => void;
  saveToStorage: () => void;
  resetState: () => void;
};

const STORAGE_KEY_TARGETS = "lastKitchenTargets";
const STORAGE_KEY_KITCHEN = "lastKitchenState_v1";

const defaultState: KitchenState = {
  targets: null,
  locations: [],
  activeLocation: null,
  dough: {},
  rolling: {},
  oven: {},
  topping: {},
  completedLocations: {},
  lastUpdatedAt: null,
};

const KitchenContext = createContext<KitchenContextValue | undefined>(undefined);

export const KitchenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setInnerState] = useState<KitchenState>(defaultState);

  // helper: build blank stage arrays based on targets payload
  const buildStateFromTargets = (parsedTargets: TargetsPayload | null): KitchenState => {
    if (!parsedTargets) return defaultState;
    const locations = Object.keys(parsedTargets.summaryPerLocation ?? {});
    const dough: Record<string, DoughStageRow[]> = {};
    const rolling: Record<string, RollingRow[]> = {};
    const oven: Record<string, OvenRow[]> = {};
    const topping: Record<string, ToppingRow[]> = {};
    const completedLocations: Record<string, boolean> = {};
    for (const loc of locations) {
      dough[loc] = [];
      rolling[loc] = [];
      oven[loc] = [];
      topping[loc] = [];
      completedLocations[loc] = false;
    }

    for (const p of parsedTargets.products ?? []) {
      for (const loc of locations) {
        const t = Number(p.totals?.[loc] ?? 0);
        dough[loc].push({ productName: p.productName, target: t, produced: 0 });
        rolling[loc].push({
          productName: p.productName,
          target: t,
          starterNeeded: 0,
          starterProduced: 0,
          fillingNeeded: 0,
          fillingProduced: 0,
          rolledProduced: 0,
        });
        oven[loc].push({ productName: p.productName, toOven: 0, outOfOven: 0, reject: 0 });
        topping[loc].push({ productName: p.productName, sfgTopping: 0, fgTopping: 0 });
      }
    }

    return {
      targets: parsedTargets,
      locations,
      activeLocation: locations.length ? locations[0] : null,
      dough,
      rolling,
      oven,
      topping,
      completedLocations,
      lastUpdatedAt: new Date().toISOString(),
    };
  };

  // load targets and/or persisted kitchen state on mount
  useEffect(() => {
    try {
      const rawTargets = sessionStorage.getItem(STORAGE_KEY_TARGETS);
      const parsedTargets: TargetsPayload | null = rawTargets ? JSON.parse(rawTargets) : null;

      const rawState = sessionStorage.getItem(STORAGE_KEY_KITCHEN);
      const parsedState: KitchenState | null = rawState ? JSON.parse(rawState) : null;

      if (parsedState) {
        setInnerState(parsedState);
        return;
      }

      if (parsedTargets) {
        setInnerState(buildStateFromTargets(parsedTargets));
      }
    } catch (err) {
      console.warn("KitchenContext: failed to initialize", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setState = (updater: Partial<KitchenState> | ((s: KitchenState) => KitchenState)) => {
    setInnerState((prev) => {
      const next = typeof updater === "function" ? (updater as (s: KitchenState) => KitchenState)(prev) : { ...prev, ...updater };
      return next;
    });
  };

  // new: setTargets - load targets payload into kitchen state (used by KitchenDashboard)
  const setTargets = (payload: TargetsPayload | null) => {
    if (!payload) {
      // clear targets
      setInnerState(defaultState);
      sessionStorage.removeItem(STORAGE_KEY_TARGETS);
      sessionStorage.removeItem(STORAGE_KEY_KITCHEN);
      return;
    }
    try {
      // store raw targets separately (so other pages that only read targets can access)
      sessionStorage.setItem(STORAGE_KEY_TARGETS, JSON.stringify(payload));
      const newState = buildStateFromTargets(payload);
      // also persist minimal kitchen state if needed
      sessionStorage.setItem(STORAGE_KEY_KITCHEN, JSON.stringify(newState));
      setInnerState(newState);
    } catch (err) {
      console.warn("KitchenContext: setTargets failed", err);
    }
  };

  const saveToStorage = () => {
    try {
      const payload = { ...state, lastUpdatedAt: new Date().toISOString() };
      sessionStorage.setItem(STORAGE_KEY_KITCHEN, JSON.stringify(payload));
      // also persist raw targets for reuse
      if (state.targets) sessionStorage.setItem(STORAGE_KEY_TARGETS, JSON.stringify(state.targets));
      setInnerState(payload);
    } catch (err) {
      console.warn("KitchenContext: failed to save", err);
    }
  };

  const resetState = () => {
    sessionStorage.removeItem(STORAGE_KEY_KITCHEN);
    sessionStorage.removeItem(STORAGE_KEY_TARGETS);
    setInnerState(defaultState);
  };

  const value = useMemo(
    () => ({ state, setState, setTargets, saveToStorage, resetState }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state]
  );

  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>;
};

export const useKitchen = (): KitchenContextValue => {
  const ctx = useContext(KitchenContext);
  if (!ctx) throw new Error("useKitchen must be used inside KitchenProvider");
  return ctx;
};
