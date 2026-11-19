"use client";

import { useRef, useState } from "react";
import { BookOpen, ExternalLink, Settings, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdvisorSetupCard } from "@/components/advisor/setup-card";
import { ErrorNote, Panel, shortDate } from "@/components/advisor/bits";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/shell/page-header";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { useSession } from "@/hooks/use-session";
import config from "@/lib/iblai/config";
import { AdminRequestError } from "@/lib/advisor/admin-client";
import { useAdvisorApi, useAdvisorData, type CatalogData } from "@/lib/advisor/use-advisor-api";
import { useAdvisorSettings } from "@/lib/advisor/use-advisor-settings";
import { VOCAB } from "@/lib/advisor/vocabulary";

/** Advisor-only: the agent, and the catalog the whole app reads. */
export default function SettingsPage() {
  const { href, tenantKey } = useSession();
  useBreadcrumbs([{ label: "Settings", href: href("/settings") }]);
  const { agentId, settings } = useAdvisorSettings();
  const catalog = useAdvisorData<CatalogData>("/catalog");
  const { send } = useAdvisorApi();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const importFile = async (file: File) => {
    setBusy(true);
    setProblems([]);
    try {
      const parsed = JSON.parse(await file.text());
      const r = await send<{ courses: number; programs: number }>("/catalog", "POST", parsed);
      toast.success(`Catalog replaced: ${r.courses} courses, ${r.programs} programs`);
      catalog.reload();
    } catch (e) {
      const errors = e instanceof AdminRequestError ? (e.body as { errors?: string[] } | undefined)?.errors : null;
      setProblems(errors?.length ? errors : [e instanceof Error ? e.message : "Could not read that file"]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <PageHeader
        icon={<Settings />}
        title="Settings"
        description={`The ${VOCAB.advisor} agent and the catalog this organization advises from`}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto grid max-w-3xl gap-4">
          <Panel
            title={
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-4 text-[#0058cc]" /> {VOCAB.advisor} agent
              </span>
            }
            description={
              agentId
                ? `Set up ${shortDate(settings.setupCompletedAt as string | undefined)} · re-run setup to push the latest prompt, skills and knowledge`
                : "Not set up in this organization yet"
            }
            actions={
              agentId ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <a
                      href={`${config.osUrl()}/platform/${encodeURIComponent(tenantKey)}/${agentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  Open in the OS <ExternalLink data-icon="inline-end" />
                </Button>
              ) : null
            }
            className="overflow-hidden"
          >
            <div className="-m-4">
              <AdvisorSetupCard compact />
            </div>
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-1.5">
                <BookOpen className="size-4 text-[#0058cc]" /> Catalog
              </span>
            }
            description="What pathways, the agent's tools and the opportunities report are built from"
            actions={
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  aria-label="Catalog JSON file"
                  onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])}
                />
                <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />} Import catalog JSON
                </Button>
              </>
            }
          >
            {catalog.error ? <ErrorNote>{catalog.error}</ErrorNote> : null}
            {catalog.data ? (
              <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-[9rem_1fr]">
                <dt className="text-muted-foreground">Institution</dt>
                <dd className="text-gray-900">{catalog.data.institution}</dd>
                <dt className="text-muted-foreground">Catalog</dt>
                <dd className="text-gray-900">{catalog.data.catalog}</dd>
                <dt className="text-muted-foreground">Loaded</dt>
                <dd className="text-gray-900">
                  {catalog.data.courses.length} courses · {catalog.data.programs.length} program
                  {catalog.data.programs.length === 1 ? "" : "s"} · read {shortDate(catalog.data.capturedAt)}
                </dd>
                <dt className="text-muted-foreground">Source</dt>
                <dd>
                  <a className="text-[#0058cc] hover:underline" href={catalog.data.source} target="_blank" rel="noopener noreferrer">
                    {catalog.data.source}
                  </a>
                </dd>
                <dt className="text-muted-foreground">Coverage</dt>
                <dd className="text-gray-700">{catalog.data.coverage}</dd>
              </dl>
            ) : null}
            {problems.length ? (
              <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700" role="alert">
                <p className="font-medium">The file was not imported:</p>
                <ul className="mt-1 list-disc pl-5">
                  {problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-muted-foreground mt-3 text-xs">
              The file has <code className="font-mono">institution</code>, <code className="font-mono">courses[]</code> (code, title, credits,
              subject, department, description, prereqText) and <code className="font-mono">programs[]</code> with requirement groups —
              the same shape as <code className="font-mono">data/catalog/citytech.json</code>. Importing replaces the loaded catalog;
              re-run agent setup afterwards so its knowledge matches.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
