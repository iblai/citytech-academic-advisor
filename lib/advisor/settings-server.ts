/**
 * Server-side access to the app's organization settings
 * (`metadata.apps.advisor` in the org's public metadata object).
 *
 * Reads are public on the platform. Writes act with the caller's credential
 * and always GET → merge → PUT so the OS's own keys survive.
 * Relative imports on purpose (vitest, CLI).
 */
import { platformBase, platformFetch } from "../iblai/platform";
import { mergeAdvisorSettings, readAdvisorSettings, type AdvisorSettings } from "./org-settings";

const enc = encodeURIComponent;
const metaPath = (org: string) => `/dm/api/core/orgs/${enc(org)}/metadata/`;
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

/**
 * `load()` cached for a minute per key, and served from the last good copy
 * when the platform throttles or hiccups (`load` answers `undefined`), so a
 * live landing page or a tool call never disappears behind a 429.
 */
async function cached<T>(key: string, load: () => Promise<T | undefined>): Promise<T | undefined> {
  const hit = cache.get(key) as { at: number; value: T } | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  let value = await load();
  if (value === undefined) {
    await new Promise((r) => setTimeout(r, 1500));
    value = await load();
  }
  if (value === undefined) return hit?.value;
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** An anonymous GET: the body, `missing` for a 404/403, `undefined` when transient. */
async function publicGet<T>(path: string, missing: T): Promise<T | undefined> {
  const res = await fetch(`${platformBase()}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);
  if (res?.ok) return ((await res.json().catch(() => null)) as T | null) ?? missing;
  if (res && (res.status === 404 || res.status === 403)) return missing;
  return undefined; // throttled (429), network, 5xx
}

/** The org's whole metadata object (cached, see `cached`). */
export async function readOrgMetadata(org: string): Promise<Record<string, unknown>> {
  if (!org) return {};
  const data = await cached(`metadata:${org}`, () =>
    publicGet<{ metadata?: Record<string, unknown> }>(metaPath(org), {}),
  );
  return data?.metadata ?? {};
}

/** Forget the cached copy (after this server wrote the metadata). */
export function invalidateOrgMetadata(org: string) {
  cache.delete(`metadata:${org}`);
}

export async function readAdvisorSettingsServer(org: string): Promise<AdvisorSettings> {
  return readAdvisorSettings(await readOrgMetadata(org));
}

/** Merge `patch` into the app's namespace and save, acting as `authorization`. */
export async function writeAdvisorSettings(
  org: string,
  patch: Partial<AdvisorSettings>,
  authorization: string,
): Promise<AdvisorSettings> {
  const latest = await platformFetch<{ metadata?: Record<string, unknown> }>(
    metaPath(org),
    authorization,
  );
  const merged = mergeAdvisorSettings(latest?.metadata ?? {}, patch);
  await platformFetch(metaPath(org), authorization, {
    method: "PUT",
    body: { metadata: merged },
  });
  cache.set(`metadata:${org}`, { at: Date.now(), value: { metadata: merged } });
  return readAdvisorSettings(merged);
}
