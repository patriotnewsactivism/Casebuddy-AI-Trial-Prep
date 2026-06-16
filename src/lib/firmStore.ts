// CaseBuddy AI — Firm Profile / White-Label Store
// Lets a law firm brand the platform as their own (TODO 4.4): firm name,
// accent color, logo, and a white-label switch that hides CaseBuddy branding.
// Same localStorage + useSyncExternalStore pattern as caseStore/leadStore.

import { useSyncExternalStore } from 'react';

export interface FirmProfile {
  firmName: string;        // shown in the sidebar, exports, and Sierra's widget
  tagline: string;
  accentColor: string;     // hex, used by Sierra's embeddable widget
  logoUrl: string;         // optional https image URL
  whiteLabel: boolean;     // hide CaseBuddy branding across the app
}

const FIRM_KEY = 'cb_firm';

const DEFAULTS: FirmProfile = {
  firmName: '',
  tagline: 'Legal Intelligence Platform',
  accentColor: '#3b82f6',
  logoUrl: '',
  whiteLabel: false,
};

function load(): FirmProfile {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(FIRM_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

let cache: FirmProfile = load();
let version = 0;
const listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export function useFirm(): FirmProfile {
  useSyncExternalStore(subscribe, () => version);
  return cache;
}

export function getFirm(): FirmProfile {
  return cache;
}

export function setFirm(update: Partial<FirmProfile>) {
  cache = { ...cache, ...update };
  localStorage.setItem(FIRM_KEY, JSON.stringify(cache));
  version++;
  listeners.forEach(l => l());
}

// Display name for headers/exports: the firm's brand in white-label mode,
// CaseBuddy AI otherwise.
export function brandName(): string {
  return cache.whiteLabel && cache.firmName ? cache.firmName : 'CaseBuddy AI';
}
