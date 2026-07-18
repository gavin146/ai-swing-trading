import type { TimeProvider } from "./types";

export const systemTimeProvider: TimeProvider = {
  now() {
    return new Date();
  },
  nowIso() {
    return new Date().toISOString();
  },
};

export function createFixedTimeProvider(isoTimestamp: string): TimeProvider {
  const fixed = new Date(isoTimestamp);

  if (Number.isNaN(fixed.getTime())) {
    throw new Error("A valid ISO timestamp is required for fixed time.");
  }

  return {
    now() {
      return new Date(fixed);
    },
    nowIso() {
      return fixed.toISOString();
    },
  };
}
