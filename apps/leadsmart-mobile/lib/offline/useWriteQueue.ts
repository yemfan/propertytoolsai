import { useCallback, useEffect, useState } from "react";
import { subscribeReconnect } from "./onReconnect";
import {
  enqueueWrite,
  getQueueSize,
  type WriteEndpoint,
} from "./writeQueue";

/**
 * React hook for UI integration with the offline write queue.
 * Provides a `queueWrite` function and a live `pendingCount`.
 */
export function useWriteQueue(): {
  queueWrite: (endpoint: WriteEndpoint, args: unknown[]) => Promise<void>;
  pendingCount: number;
} {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const size = await getQueueSize();
    setPendingCount(size);
  }, []);

  // Read initial count on mount.
  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  // Re-read after reconnect (queue may have shrunk from replay).
  useEffect(() => {
    return subscribeReconnect(() => {
      // Small delay so replay has a moment to process items.
      setTimeout(() => void refreshCount(), 2000);
    });
  }, [refreshCount]);

  // Poll every 5 seconds since replay happens asynchronously
  // and there's no other notification mechanism.
  useEffect(() => {
    const id = setInterval(() => void refreshCount(), 5000);
    return () => clearInterval(id);
  }, [refreshCount]);

  const queueWrite = useCallback(
    async (endpoint: WriteEndpoint, args: unknown[]) => {
      await enqueueWrite(endpoint, args);
      await refreshCount();
    },
    [refreshCount]
  );

  return { queueWrite, pendingCount };
}
