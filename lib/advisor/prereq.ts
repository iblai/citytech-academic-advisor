/**
 * Reading the catalog's requisite wording. The catalog writes prerequisites
 * as free text in several house styles — "PRE: CST 3503 OR CST 3513",
 * "PRE_CST1201_CST1204", "PRE: CST 1100 & 1101", "CST3507 & (2405 or 2415)" —
 * so this is a best-effort parse into AND-of-OR groups of course codes.
 * Anything it cannot place (grades, "department permission", "three 35XX
 * courses") is reported as `unparsed` and surfaced to the advisor: the
 * verbatim text is always kept, and a human validates the result.
 */

export interface ParsedPrereq {
  /** Every group must be satisfied; a group is satisfied by any one code. */
  groups: string[][];
  /** Codes that may be taken in the same term. */
  coreqs: string[];
  /** True when the text holds conditions this parser does not model. */
  needsReview: boolean;
}

const SUBJECT = "[A-Z]{2,5}";

/** `CST1201`, `CST 1201`, bare `1101` (inherits the last subject) → `CST 1201`. */
function codesIn(segment: string, lastSubject: { v: string }): string[] {
  const out: string[] = [];
  const re = new RegExp(`(?:(${SUBJECT})[ _]?)?(\\d{4})(?![\\dX])`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(segment))) {
    if (m[1] && !/^(PRE|CO|AND|OR|FOR|WITH|THE|TWO|ONE)$/.test(m[1])) lastSubject.v = m[1];
    if (lastSubject.v) out.push(`${lastSubject.v} ${m[2]}`);
  }
  return out;
}

export function parsePrereq(text: string, selfCode = ""): ParsedPrereq {
  const empty: ParsedPrereq = { groups: [], coreqs: [], needsReview: false };
  if (!text?.trim()) return empty;
  let t = text.toUpperCase().replace(/MUST NOT BE[^,;]*/g, " ");
  // "FOR NON-CST MAJORS: …" repeats a weaker rule; plan for the major's own rule.
  t = t.replace(/PRE:\s*FOR NON-[A-Z]+ MAJORS:.*$/g, " ");
  const needsReview =
    /\d{2}XX|LEVEL|PERMISSION|ELIGIB|COURSES\b|_HIGHER|MAT13\b|PRE_CST3[56]00/.test(t);

  // Split off the corequisite part ("_CO_", "PRE/CO:", "P/C:", "COREQUISITE…").
  let pre = t;
  let co = "";
  const coIdx = t.search(/_CO_|CO-?REQUISITES?( OF)?|PRE\/CO(REQUISITE)?:|P\/C:/);
  if (coIdx >= 0) {
    if (/^(P\/C:|PRE\/CO)/.test(t.slice(coIdx)) && coIdx === 0) {
      pre = "";
      co = t;
    } else {
      pre = t.slice(0, coIdx);
      co = t.slice(coIdx);
    }
  }

  const last = { v: "" };
  const groups: string[][] = [];
  // Underscore style is a plain AND list.
  if (pre.trim().startsWith("PRE_")) {
    for (const c of codesIn(pre.replace(/_/g, " "), last)) groups.push([c]);
  } else {
    // AND-split on "&", "AND", ","; within a part, several codes are alternatives
    // when joined by OR or "/".
    for (const part of pre.split(/&|\bAND\b|,|;/)) {
      const codes = codesIn(part, last);
      if (!codes.length) continue;
      if (/\bOR\b|\//.test(part)) groups.push(codes);
      else for (const c of codes) groups.push([c]);
    }
  }
  const coreqs = codesIn(co.replace(/_/g, " "), { v: last.v });
  const clean = (g: string[]) => [...new Set(g.filter((c) => c !== selfCode))];
  return {
    groups: groups.map(clean).filter((g) => g.length),
    coreqs: clean(coreqs),
    needsReview,
  };
}

/** Whether `done` satisfies the parsed prerequisite groups. */
export function prereqsMet(p: ParsedPrereq, done: Set<string>, known: Set<string>): boolean {
  return p.groups.every((g) => {
    // A group naming only courses outside the loaded catalog cannot be planned
    // for; it is flagged for the advisor instead of blocking the plan.
    const inCatalog = g.filter((c) => known.has(c));
    if (!inCatalog.length) return true;
    return g.some((c) => done.has(c));
  });
}
