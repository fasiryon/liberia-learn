/**
 * RX-005 A3. Renderer chunks are network dependencies: retry a failed dynamic import, then let the caller
 * downgrade instead of crashing the lab.
 */
export async function loadWithRetry<T>(load: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (retries <= 0) throw error;
    return loadWithRetry(load, retries - 1);
  }
}
