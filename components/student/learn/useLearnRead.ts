"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readError, type LearnRead } from "./learnPresentation";

/**
 * One authorized GET with honest states: a failed refresh keeps the last
 * loaded rows but marks them stale; a failure is never turned into empty.
 */
export function useLearnRead<T>(url: string, valid: (data: unknown) => boolean) {
  const [value, setValue] = useState<LearnRead<T>>({ state: "loading", data: null, stale: false });
  const current = useRef<AbortController | null>(null);
  const validator = useRef(valid); validator.current = valid;
  const load = useCallback(async () => {
    current.current?.abort();
    const controller = new AbortController(); current.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    const fail = (next: Pick<LearnRead<T>, "state" | "error">) => {
      if (current.current !== controller) return;
      setValue((previous) => next.state === "error"
        ? { ...next, data: previous.data, stale: previous.data != null }
        : { ...next, data: null, stale: false });
    };
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) return fail(readError(response.status));
      const data: unknown = await response.json();
      if (!validator.current(data)) return fail({ state: "error", error: "Some learning information could not be read. Try again." });
      if (current.current === controller) setValue({ state: "ready", data: data as T, stale: false });
    } catch {
      fail({ state: "error", error: "The connection failed or took too long. Try again." });
    } finally { clearTimeout(timeout); }
  }, [url]);
  useEffect(() => { void load(); return () => { current.current?.abort(); current.current = null; }; }, [load]);
  return [value, load] as const;
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return online;
}
