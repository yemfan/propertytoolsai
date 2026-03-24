"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function useDashboardData<T>(
  baseUrl: string,
  query?: Record<string, string | number | undefined>
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  const queryKey = JSON.stringify(query ?? {});

  const url = useMemo(() => {
    const params = new URLSearchParams();

    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });

    return `${baseUrl}${params.toString() ? `?${params.toString()}` : ""}`;
  }, [baseUrl, queryKey]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(url, { cache: "no-store", credentials: "include" });
        const json = await res.json();

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (res.status === 403) {
          setError("You do not have access to this dashboard.");
          return;
        }

        if (!res.ok || json?.success === false) {
          throw new Error(json?.error || "Failed to load dashboard");
        }

        if (active) setData(json);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [url, router]);

  return { data, loading, error };
}
