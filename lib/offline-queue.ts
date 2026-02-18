// lib/offline-queue.ts — Client-side offline completion queue using IndexedDB
"use client";

import { get, set, del } from "idb-keyval";

const QUEUE_KEY = "liberialearn_offline_queue";

type QueueItem = {
  scheduledWorkId: string;
  completedAt: string;
};

export async function addToQueue(scheduledWorkId: string, completedAt: string): Promise<void> {
  const queue = await getQueue();
  // Deduplicate
  if (queue.some((q) => q.scheduledWorkId === scheduledWorkId)) return;
  queue.push({ scheduledWorkId, completedAt });
  await set(QUEUE_KEY, queue);
}

export async function getQueue(): Promise<QueueItem[]> {
  return (await get<QueueItem[]>(QUEUE_KEY)) || [];
}

export async function clearQueue(): Promise<void> {
  await del(QUEUE_KEY);
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
