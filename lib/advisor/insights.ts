/**
 * Where the curriculum and the job market disagree. For every skill the
 * market asks for, look at which catalog courses teach it; skills in demand
 * with no course — or a single one — are candidates for a microcredential or
 * a workshop the college could develop. A proposal for people to judge, not a
 * decision: an administrator reviews each one.
 */
import type { LoadedCatalog } from "./catalog";
import { skillDemand, type JobMarket } from "./jobs";
import type { Opportunity } from "./types";

export function opportunities(market: JobMarket, catalog: LoadedCatalog): Opportunity[] {
  const demand = skillDemand(market, catalog);
  const out: Opportunity[] = [];
  for (const d of demand) {
    if (d.postings < 3) continue;
    const kind: Opportunity["kind"] | null =
      d.courses.length === 0 ? "gap" : d.courses.length === 1 ? "thin" : d.share >= 0.2 && d.emerging ? "reinforce" : null;
    if (!kind) continue;
    const employers = [
      ...new Set(market.postings.filter((p) => p.skills.includes(d.id)).map((p) => p.employer)),
    ].slice(0, 4);
    const pct = Math.round(d.share * 100);
    const format: Opportunity["format"] =
      kind === "gap" ? (d.emerging || d.share >= 0.15 ? "Microcredential" : "Workshop") : kind === "thin" ? "Workshop series" : "Microcredential";
    out.push({
      skillId: d.id,
      skill: d.name,
      group: d.group,
      emerging: d.emerging,
      postings: d.postings,
      share: d.share,
      coveredBy: d.courses,
      kind,
      format,
      title:
        format === "Microcredential"
          ? `${d.name} microcredential`
          : format === "Workshop"
            ? `${d.name} workshop`
            : `${d.name} workshop series`,
      rationale:
        kind === "gap"
          ? `${d.postings} of ${market.postings.length} postings (${pct}%) ask for it and no loaded course teaches it.`
          : kind === "thin"
            ? `${d.postings} postings (${pct}%) ask for it; only ${d.courses[0]} teaches it.`
            : `${pct}% of postings ask for it. ${d.courses.length} courses teach it — a stackable credential would make that visible to employers.`,
      sampleEmployers: employers,
    });
  }
  const rank = { gap: 0, thin: 1, reinforce: 2 } as const;
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || b.postings - a.postings);
}
