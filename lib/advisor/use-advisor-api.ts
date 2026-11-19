"use client";

/**
 * Browser access to this app's advisor routes for the organization in the
 * URL. `adminFetch` forwards the signed-in user's session token so the server
 * knows who is asking.
 */
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { adminFetch } from "@/lib/advisor/admin-client";
import type { PublicCourse } from "@/lib/advisor/catalog";
import type {
  JobPosting,
  Opportunity,
  Pathway,
  Plan,
  Program,
  RoleProfile,
  SkillDemand,
} from "@/lib/advisor/types";

export interface CatalogData {
  institution: string;
  catalog: string;
  source: string;
  capturedAt: string;
  coverage: string;
  programs: Program[];
  courses: PublicCourse[];
}

export interface MarketData {
  source: string;
  sourceUrl: string;
  live: boolean;
  fetchedAt: string;
  postings: JobPosting[];
  roles: RoleProfile[];
  demand: SkillDemand[];
  opportunities: Opportunity[];
}

export function useAdvisorApi() {
  const { tenantKey } = useSession();
  const base = `/api/advisor/${encodeURIComponent(tenantKey)}`;
  return {
    base,
    get: useCallback(<T,>(path: string) => adminFetch<T>(`${base}${path}`), [base]),
    send: useCallback(
      <T,>(path: string, method: string, json?: unknown) => adminFetch<T>(`${base}${path}`, { method, json }),
      [base],
    ),
  };
}

/** GET an advisor route; `reload()` re-reads it. */
export function useAdvisorData<T>(path: string | null) {
  const { get } = useAdvisorApi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setLoading(true);
    get<T>(path)
      .then((d) => {
        if (!live) return;
        setData(d);
        setError("");
      })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [get, path, tick]);
  return { data, error, loading, reload: useCallback(() => setTick((n) => n + 1), []) };
}

export type { Pathway, Plan };
