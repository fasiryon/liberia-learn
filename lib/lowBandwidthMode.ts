"use client";

export const LOW_BANDWIDTH_STORAGE_KEY = "liberialearn.low_bandwidth_mode";

export type LowBandwidthPreference = "auto" | "on" | "off";

export function normalizeLowBandwidthPreference(value: unknown): LowBandwidthPreference {
  return value === "on" || value === "off" ? value : "auto";
}

export function detectLowBandwidthConnection(connection?: {
  saveData?: boolean;
  effectiveType?: string;
} | null) {
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === "slow-2g" || connection.effectiveType === "2g";
}

export function resolveLowBandwidthMode(
  preference: LowBandwidthPreference,
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  } | null
) {
  if (preference === "on") return true;
  if (preference === "off") return false;
  return detectLowBandwidthConnection(connection);
}

export function readLowBandwidthPreference(storage?: Pick<Storage, "getItem"> | null) {
  if (!storage) return "auto" as LowBandwidthPreference;
  return normalizeLowBandwidthPreference(storage.getItem(LOW_BANDWIDTH_STORAGE_KEY));
}

export function persistLowBandwidthPreference(
  storage: Pick<Storage, "setItem">,
  preference: LowBandwidthPreference
) {
  storage.setItem(LOW_BANDWIDTH_STORAGE_KEY, preference);
}

export function applyLowBandwidthAttribute(
  root: Pick<HTMLElement, "dataset">,
  enabled: boolean
) {
  root.dataset.lowBandwidth = enabled ? "true" : "false";
}
