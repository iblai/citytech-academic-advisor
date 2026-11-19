"use client";

/**
 * The app's organization settings (`metadata.apps.advisor`) in the browser,
 * for the organization in the URL. Any member can read (public metadata);
 * writes need an org admin — the platform answers 403 otherwise — and always
 * GET → merge → PUT so the OS's own keys and other apps' namespaces survive.
 */
import { useCallback, useMemo } from "react";
import {
  useGetTenantMetadataQuery,
  useUpdateTenantMetadataMutation,
} from "@iblai/iblai-js/data-layer";
import { useSession } from "@/hooks/use-session";
import config from "@/lib/iblai/config";
import {
  mergeAdvisorSettings,
  readAdvisorSettings,
  institutionBranding,
  type AdvisorSettings,
} from "@/lib/advisor/org-settings";

type OrgMetadataResponse = { metadata?: Record<string, unknown>; [k: string]: unknown };
type PlatformPublicMetadataBody = NonNullable<
  Parameters<ReturnType<typeof useUpdateTenantMetadataMutation>[0]>[0][0]["requestBody"]
>;

export function useAdvisorSettings() {
  const { tenantKey: org } = useSession();
  // The tenant slice takes its args as a one-element tuple.
  const query = useGetTenantMetadataQuery([{ org }], { skip: !org });
  const [mutate, mutation] = useUpdateTenantMetadataMutation();
  const current = query.data as OrgMetadataResponse | undefined;

  const settings = useMemo<AdvisorSettings>(
    () => readAdvisorSettings(current?.metadata),
    [current],
  );
  const branding = useMemo(() => institutionBranding(current?.metadata, org), [current, org]);
  /** The advisor: pinned by env, else what an admin set up. */
  const agentId = config.defaultAgentId() || settings.agentId || "";

  const update = useCallback(
    async (patch: Partial<AdvisorSettings>, remove: string[] = []) => {
      // Re-read right before writing: PUT replaces the object, and another
      // admin (or the advisor) may have changed it since this page loaded.
      const latest = (await query.refetch().unwrap()) as OrgMetadataResponse;
      const metadata = mergeAdvisorSettings(latest?.metadata, patch, remove);
      await mutate([
        { org, requestBody: { metadata } as unknown as PlatformPublicMetadataBody },
      ]).unwrap();
    },
    [mutate, org, query],
  );

  return {
    settings,
    branding,
    agentId,
    update,
    isLoading: query.isLoading,
    isSaving: mutation.isLoading,
    error: query.error ?? mutation.error,
    refetch: query.refetch,
  };
}
