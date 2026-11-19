/**
 * Where pathways and their reviews are kept. This build stores them in a
 * JSON file on the app server (`.data/pathways.json`, gitignored) so the
 * whole student → advisor loop runs on a laptop; the functions below are the
 * only place that knows that, so a database or the platform's own pathway
 * API can replace it without touching a route. Server-only.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Pathway, PathwayReview, Plan } from "./types";

const FILE = path.join(process.cwd(), ".data", "pathways.json");

function readAll(): Pathway[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Pathway[];
  } catch {
    return [];
  }
}

function writeAll(rows: Pathway[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 1));
  fs.renameSync(tmp, FILE);
}

export function listPathways(org: string, student?: string): Pathway[] {
  return readAll()
    .filter((p) => p.org === org && (!student || p.student === student))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getPathway(org: string, id: string): Pathway | undefined {
  return readAll().find((p) => p.org === org && p.id === id);
}

export function savePathway(input: {
  org: string;
  student: string;
  studentName: string;
  plan: Plan;
  studentNote?: string;
  submit?: boolean;
  id?: string;
}): Pathway {
  const rows = readAll();
  const now = new Date().toISOString();
  const existing = input.id
    ? rows.find((p) => p.id === input.id && p.org === input.org && p.student === input.student)
    : undefined;
  if (existing) {
    existing.plan = input.plan;
    existing.studentNote = input.studentNote ?? existing.studentNote;
    existing.updatedAt = now;
    // Editing an approved pathway makes it a draft again: approval is for one exact plan.
    existing.status = input.submit ? "submitted" : "draft";
    if (input.submit) existing.submittedAt = now;
    writeAll(rows);
    return existing;
  }
  const row: Pathway = {
    id: randomUUID(),
    org: input.org,
    student: input.student,
    studentName: input.studentName || input.student,
    status: input.submit ? "submitted" : "draft",
    plan: input.plan,
    studentNote: input.studentNote ?? "",
    reviews: [],
    createdAt: now,
    updatedAt: now,
    submittedAt: input.submit ? now : null,
  };
  rows.push(row);
  writeAll(rows);
  return row;
}

export function reviewPathway(
  org: string,
  id: string,
  review: Omit<PathwayReview, "at">,
): Pathway | undefined {
  const rows = readAll();
  const row = rows.find((p) => p.org === org && p.id === id);
  if (!row) return undefined;
  const now = new Date().toISOString();
  row.reviews.push({ ...review, at: now });
  if (review.decision !== "comment") row.status = review.decision;
  row.updatedAt = now;
  writeAll(rows);
  return row;
}

export function deletePathway(org: string, id: string, student: string): boolean {
  const rows = readAll();
  const next = rows.filter((p) => !(p.org === org && p.id === id && p.student === student));
  if (next.length === rows.length) return false;
  writeAll(next);
  return true;
}
