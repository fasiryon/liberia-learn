"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import LabShell from "@/components/labs/LabShell";
import {
  isWeatherSystemAction,
  type WeatherSystemAction,
} from "@/lib/labs/weather-system/actions";
import { applyWeatherSystemAction } from "@/lib/labs/weather-system/runtime";
import {
  WEATHER_INITIAL_STATE,
  type WeatherSystemState,
} from "@/lib/labs/weather-system/state";
import type { PlannedLabAction } from "@/lib/labs/types";

const SUGGESTED_PROMPTS = [
  "Simulate a storm",
  "What happens during Liberia's rainy season?",
  "Why does it snow only when very cold?",
];

const WeatherSystemScene = lazy(() => import("@/components/labs/weather-system/Scene"));
const WeatherSystemFallback = lazy(() => import("@/components/labs/weather-system/Fallback"));

export default function WeatherSystemLabPage({ lessonId }: { lessonId?: string | null }) {
  const [state, setState] = useState<WeatherSystemState>(WEATHER_INITIAL_STATE);

  const applyAction = useCallback((action: WeatherSystemAction) => {
    setState((current) => applyWeatherSystemAction(current, action));
  }, []);

  const handlePlannedAction = useCallback((planned: PlannedLabAction, currentState: unknown) => {
    if (!planned.action || !isWeatherSystemAction(planned.action)) {
      return currentState;
    }
    const nextState = applyWeatherSystemAction(currentState as WeatherSystemState, planned.action);
    setState(nextState);
    return nextState;
  }, []);

  return (
    <LabShell
      labId="weather-system"
      lessonId={lessonId}
      initialState={WEATHER_INITIAL_STATE}
      state={state}
      onAction={handlePlannedAction}
      suggestedPrompts={SUGGESTED_PROMPTS}
      fallback={
        <Suspense fallback={<div className="rounded-md border border-slate-200 p-4 text-sm text-slate-600">Loading lab fallback...</div>}>
          <WeatherSystemFallback state={state} onAction={applyAction} />
        </Suspense>
      }
    >
      <WeatherSystemScene state={state} onAction={applyAction} />
    </LabShell>
  );
}
