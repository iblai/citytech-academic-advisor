"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Route,
  MessageSquarePlus,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/shell/page-header";
import { LoadingScreen } from "@/components/loading-screen";
import { Glance } from "@/components/advisor/glance";
import { AdvisorChat } from "@/components/advisor/chat";
import { AdvisorSetupCard } from "@/components/advisor/setup-card";
import { useSampleMode } from "@/hooks/use-sample-mode";
import { useSession } from "@/hooks/use-session";
import { useAdvisorSettings } from "@/lib/advisor/use-advisor-settings";
import { VOCAB } from "@/lib/advisor/vocabulary";
import { cn } from "@/lib/utils";

const BRIEF_KEY = "advisor.home.glance";

/**
 * Home is a conversation with the Pathways Advisor — the agent students and
 * advisors both talk to — with the pathway's status beside it. The
 * agent is the one an admin set up for this organization (or the one pinned
 * by NEXT_PUBLIC_DEFAULT_AGENT_ID); without one, and on the community
 * organization's sample, the setup card takes its place.
 */
export default function HomePage() {
  const router = useRouter();
  const { href, displayName } = useSession();
  const { agentId: orgAgentId, isLoading } = useAdvisorSettings();
  // The sample has no advisor of its own.
  const agentId = useSampleMode() ? "" : orgAgentId;
  const [showBrief, setShowBrief] = useState(true);

  useEffect(() => {
    try {
      setShowBrief(window.localStorage.getItem(BRIEF_KEY) !== "0");
    } catch {
      /* ignore */
    }
  }, []);
  const toggleBrief = () => {
    setShowBrief((v) => {
      try {
        window.localStorage.setItem(BRIEF_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  };

  return (
    <>
      <PageHeader
        icon={<Sparkles />}
        title={VOCAB.advisor}
        description={`Good to see you${displayName ? `, ${displayName.split(" ")[0]}` : ""} — ask what you still need, what to take next, or where your degree can take you`}
        actions={
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" size="sm" render={<Link href={href("/pathway")} />} />
                }
              >
                <Route data-icon="inline-start" /> My pathway
              </TooltipTrigger>
              <TooltipContent side="bottom">Build or open your term-by-term pathway</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden xl:inline-flex"
                    onClick={toggleBrief}
                    aria-pressed={showBrief}
                  />
                }
              >
                {showBrief ? (
                  <PanelRightClose data-icon="inline-start" />
                ) : (
                  <PanelRightOpen data-icon="inline-start" />
                )}
                At a glance
              </TooltipTrigger>
              <TooltipContent side="bottom">Show or hide the side panel</TooltipContent>
            </Tooltip>
            {agentId ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="sm"
                      className="ibl-button-primary"
                      onClick={() => router.push(`${href()}?new=${Date.now().toString(36)}`)}
                    />
                  }
                >
                  <MessageSquarePlus data-icon="inline-start" /> New conversation
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Start a fresh thread with the {VOCAB.advisor}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </>
        }
      />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
          {isLoading && !agentId ? (
            <LoadingScreen className="min-h-0 flex-1" />
          ) : agentId ? (
            <AdvisorChat agentId={agentId} />
          ) : (
            <div className="flex-1 overflow-auto">
              <AdvisorSetupCard />
            </div>
          )}
        </div>
        <aside
          className={cn(
            "hidden w-80 shrink-0 overflow-auto border-l border-[var(--border-color,#e5e7eb)] bg-[var(--sidebar-bg,#fafbfc)]",
            showBrief && "xl:block",
          )}
          aria-label="At a glance"
        >
          <Glance />
        </aside>
      </div>
    </>
  );
}
