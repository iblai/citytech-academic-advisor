"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { NextIntlClientProvider } from "next-intl";
import { setOpenPricingModal } from "@iblai/iblai-js/web-utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider } from "@iblai/iblai-js/web-containers/next";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { BreadcrumbProvider } from "@/components/shell/breadcrumbs";
import { AdminModeProvider, useAdminMode } from "@/components/shell/admin-mode";
import {
  AssistantPanel,
  AssistantPanelProvider,
} from "@/components/advisor/assistant-panel";
import { LoadingScreen } from "@/components/loading-screen";
import { OrganizationPreview } from "@/components/house/organization-preview";
import { UpgradeModal } from "@/components/house/upgrade-modal";
import { useSampleMode } from "@/hooks/use-sample-mode";
import { useSession } from "@/hooks/use-session";
import config from "@/lib/iblai/config";
import { decideEntry } from "@/lib/iblai/house-journeys";
import { readStoredTenantKey } from "@/lib/iblai/tenant";
import messages from "@/messages/en.json";

/**
 * Everything under `/platform/[tenantKey]` — the authenticated, org-scoped
 * advising workspace: sidebar + top bar around the page, with the
 * Pathways Advisor available in a side panel on every page but Home (which is the full
 * conversation). The providers above us have already verified the session
 * and the org membership. An organization the user does not belong to is
 * previewed (/iblai-vibe-house-journeys).
 */
export default function TenantLayout({ children }: { children: ReactNode }) {
  const { isAdmin, tenantKey, tenants } = useSession();
  const sample = useSampleMode();
  // Sidebar open/closed state persists in a cookie (written by the shadcn
  // sidebar); read it once on the client.
  const [defaultOpen] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    const m = document.cookie.match(/(?:^|; )sidebar_state=([^;]*)/);
    return m ? m[1] === "true" : true;
  });

  if (!tenantKey) return <LoadingScreen />;
  const entry = decideEntry({ routeOrg: tenantKey, stored: readStoredTenantKey(), tenants });
  if (entry.kind === "preview" && entry.preview) {
    return (
      <NextIntlClientProvider locale="en" messages={messages}>
        <OrganizationPreview org={entry.preview} app={config.iblPlatform()} />
      </NextIntlClientProvider>
    );
  }

  // The community organization shows the sample to everyone as its admin; the SDK
  // (sidebar footer, profile menu, first run) still sees the session's own role.
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <AdminModeProvider isAdmin={isAdmin || sample} tenantKey={tenantKey}>
        <UpgradeModal org={tenantKey} app={config.iblPlatform()} />
        <TooltipProvider>
            <BreadcrumbProvider>
              <AssistantPanelProvider>
                <SidebarProvider defaultOpen={defaultOpen} className="min-h-0">
                  <AppSidebar />
                  {/* The shell fills the safe area (body carries the insets as padding), as a div: the mobile shell's init script sizes every <main> to 100%. */}
                  <SidebarInset
                    asChild
                    className="flex h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-w-0 flex-col overflow-hidden bg-[var(--sidebar-bg,#fafbfc)]"
                  >
                    <div>
                      <TopBar />
                      <div className="flex min-h-0 flex-1">
                        <AdminGate>
                          <main
                            id="main-content"
                            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                          >
                            {children}
                          </main>
                        </AdminGate>
                        <AssistantPanel />
                      </div>
                    </div>
                  </SidebarInset>
                </SidebarProvider>
              </AssistantPanelProvider>
            </BreadcrumbProvider>
        </TooltipProvider>
      </AdminModeProvider>
    </NextIntlClientProvider>
  );
}

/**
 * `/settings`, `/review`, `/opportunities` and `/admin/*` are advisor-only, in Admin mode only. They read the
 * organization itself, so on the sample they open the upgrade dialog instead.
 */
function AdminGate({ children }: { children: ReactNode }) {
  const { adminMode } = useAdminMode();
  const sample = useSampleMode();
  const dispatch = useDispatch();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { href } = useSession();
  const gated = /\/platform\/[^/]+\/(admin|settings|review|opportunities)(\/|$)/.test(pathname);
  const blocked = gated && (!adminMode || sample);

  useEffect(() => {
    if (!blocked) return;
    if (sample) dispatch(setOpenPricingModal(true));
    router.replace(href());
  }, [blocked, sample, dispatch, router, href]);

  if (blocked) return null;
  return <>{children}</>;
}
