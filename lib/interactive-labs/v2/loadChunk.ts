/** Retry a split renderer chunk once before allowing the scene error boundary to show 2D. */
export async function loadChunkWithRetry<T>(load: () => Promise<T>, wait: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 150))): Promise<T> {
  try { return await load(); }
  catch {
    await wait();
    return load();
  }
}
