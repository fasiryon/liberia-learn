"use client";

import { useEffect, useState } from 'react';

type Drug = {
  id: string;
  brand_name: string | null;
  generic_name: string | null;
  dosage_form: string | null;
  route: string | null;
  ndc: string | null;
};

type UseDrugsResult = {
  data: Drug[];
  loading: boolean;
  error: string | null;
};

export function useDrugs(query: string): UseDrugsResult {
  const [data, setData] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const url =
          '/api/drugs' + (query ? `?q=${encodeURIComponent(query)}` : '');
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const json = (await response.json()) as { data?: Drug[] };
        if (isMounted) {
          setData(json.data ?? []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [query]);

  return { data, loading, error };
}


