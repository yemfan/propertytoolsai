"use client";

/**
 * Polling helper for `/api/support-chat/*` clients (conversation list + thread refresh).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type PollingOptions<T> = {
  enabled?: boolean;
  intervalMs?: number;
  fetcher: () => Promise<T>;
};

export function usePolling<T>({
  enabled = true,
  intervalMs = 5000,
  fetcher,
}: PollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError("");
      const result = await fetcher();
      if (!mountedRef.current) return;
      setData(result);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Polling failed");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [enabled, fetcher]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    void load();

    const timer = setInterval(() => {
      void load();
    }, intervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [enabled, intervalMs, load]);

  return {
    data,
    isLoading,
    error,
    reload: load,
  };
}
